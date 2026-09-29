// Package officecli 封装外部 OfficeCLI 引擎的调用。
//
// 设计口径见 srs/03-技术路线.md「外部文档引擎（OfficeCLI）」：
// 只做一次性子进程调用，不做常驻服务；必须带超时、输出上限和 close 收尾。
package officecli

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"time"
)

// 默认执行上限。
const (
	DefaultTimeout   = 60 * time.Second
	DefaultMaxOutput = 64 << 20 // 64MB，6MB 文档实测约 10MB JSON
)

// ErrBinaryMissing 表示本机没有可用的 OfficeCLI 二进制。
var ErrBinaryMissing = errors.New("OfficeCLI 不可用")

// ErrOutputTooLarge 表示命令输出超过上限。
var ErrOutputTooLarge = errors.New("OfficeCLI 输出超过上限")

// Client 是 OfficeCLI 的一次性调用封装。
type Client struct {
	binaryPath string
	timeout    time.Duration
	maxOutput  int64
}

// NewClient 创建客户端；binaryPath 为空时按环境变量和 PATH 查找。
func NewClient(binaryPath string) *Client {
	return &Client{
		binaryPath: strings.TrimSpace(binaryPath),
		timeout:    DefaultTimeout,
		maxOutput:  DefaultMaxOutput,
	}
}

// WithTimeout 覆盖单次命令超时。
func (c *Client) WithTimeout(timeout time.Duration) *Client {
	if timeout > 0 {
		c.timeout = timeout
	}
	return c
}

// Resolve 返回实际可执行的二进制路径。
func (c *Client) Resolve() (string, error) {
	if c.binaryPath != "" {
		if info, err := os.Stat(c.binaryPath); err == nil && !info.IsDir() {
			return c.binaryPath, nil
		}
		return "", fmt.Errorf("%w: 配置的路径不可用 %s", ErrBinaryMissing, c.binaryPath)
	}
	if fromEnv := strings.TrimSpace(os.Getenv("OFFICECLI_BINARY")); fromEnv != "" {
		if info, err := os.Stat(fromEnv); err == nil && !info.IsDir() {
			return fromEnv, nil
		}
	}
	path, err := exec.LookPath("officecli")
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrBinaryMissing, err)
	}
	return path, nil
}

// Available 报告二进制是否可用。
func (c *Client) Available() bool {
	_, err := c.Resolve()
	return err == nil
}

// Version 返回引擎版本号。
func (c *Client) Version(ctx context.Context) (string, error) {
	out, err := c.Run(ctx, "--version")
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}

// Run 执行一次 OfficeCLI 命令并返回标准输出。
func (c *Client) Run(ctx context.Context, args ...string) ([]byte, error) {
	binary, err := c.Resolve()
	if err != nil {
		return nil, err
	}

	runCtx, cancel := context.WithTimeout(ctx, c.timeout)
	defer cancel()

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	command := exec.CommandContext(runCtx, binary, args...)
	command.Stdout = &limitedWriter{w: &stdout, remaining: c.maxOutput}
	command.Stderr = &limitedWriter{w: &stderr, remaining: 8 << 10}
	if err := command.Run(); err != nil {
		if errors.Is(runCtx.Err(), context.DeadlineExceeded) {
			return nil, fmt.Errorf("OfficeCLI 执行超时（%s）: %s", c.timeout, strings.Join(args, " "))
		}
		message := strings.TrimSpace(stderr.String())
		if message == "" {
			message = err.Error()
		}
		return nil, fmt.Errorf("OfficeCLI 执行失败: %s: %s", strings.Join(args, " "), message)
	}
	return stdout.Bytes(), nil
}

// Close 释放引擎为文档保留的常驻进程与文件句柄，避免文件被锁。
func (c *Client) Close(ctx context.Context, file string) {
	if strings.TrimSpace(file) == "" {
		return
	}
	closeCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 15*time.Second)
	defer cancel()
	_, _ = c.Run(closeCtx, "close", file)
}

type limitedWriter struct {
	w         io.Writer
	remaining int64
	exceeded  bool
}

func (l *limitedWriter) Write(p []byte) (int, error) {
	if l.remaining <= 0 {
		l.exceeded = true
		return len(p), nil
	}
	if int64(len(p)) > l.remaining {
		chunk := p[:l.remaining]
		if _, err := l.w.Write(chunk); err != nil {
			return 0, err
		}
		l.remaining = 0
		l.exceeded = true
		return len(p), nil
	}
	l.remaining -= int64(len(p))
	return l.w.Write(p)
}

// 文档节点结构，对应 officecli get/query --json 的输出。
type Node struct {
	Path       string         `json:"path"`
	Type       string         `json:"type"`
	Text       string         `json:"text"`
	Preview    string         `json:"preview"`
	Style      string         `json:"style"`
	ChildCount int            `json:"childCount"`
	Format     map[string]any `json:"format"`
	Children   []Node         `json:"children"`
}

type envelope struct {
	Success bool `json:"success"`
	Data    struct {
		Matches int    `json:"matches"`
		Results []Node `json:"results"`
	} `json:"data"`
}

// Body 一次性取回文档正文树（get /body --depth N --json）。
func (c *Client) Body(ctx context.Context, file string, depth int) ([]Node, error) {
	if depth <= 0 {
		depth = 8
	}
	out, err := c.Run(ctx, "get", file, "/body", "--depth", fmt.Sprintf("%d", depth), "--json")
	if err != nil {
		return nil, err
	}
	var parsed envelope
	if err := json.Unmarshal(out, &parsed); err != nil {
		return nil, fmt.Errorf("解析 OfficeCLI 输出失败: %w", err)
	}
	if !parsed.Success {
		return nil, fmt.Errorf("OfficeCLI 返回失败状态")
	}
	if len(parsed.Data.Results) == 0 {
		return nil, nil
	}
	return parsed.Data.Results[0].Children, nil
}

// String 读取格式化字段中的字符串值。
func (n Node) String(key string) string {
	if n.Format == nil {
		return ""
	}
	value, ok := n.Format[key].(string)
	if !ok {
		return ""
	}
	return value
}

// Float 读取格式化字段中的数值。
func (n Node) Float(key string) (float64, bool) {
	if n.Format == nil {
		return 0, false
	}
	switch value := n.Format[key].(type) {
	case float64:
		return value, true
	case string:
		var parsed float64
		if _, err := fmt.Sscanf(value, "%f", &parsed); err == nil {
			return parsed, true
		}
	}
	return 0, false
}