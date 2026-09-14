package assets

import (
	"fmt"
	"path"
	"regexp"
	"strings"
	"time"
)

var (
	versionPattern           = regexp.MustCompile(`[Vv]\d{1,2}(?:\.\d{1,2}){1,2}`)
	normalizedVersionPattern = regexp.MustCompile(`^(?:[Vv])?(\d{1,2}(?:\.\d{1,2}){1,2})$`)
	trailingVersion          = regexp.MustCompile(`[\s_-]*[Vv]\d{1,2}(?:\.\d{1,2}){1,2}[\s_-]*$`)
	fileExtensionPattern     = regexp.MustCompile(`^[A-Za-z0-9]{1,12}$`)
)

func sanitizeOriginalName(value string) string {
	normalized := strings.ReplaceAll(strings.TrimSpace(value), `\`, "/")
	return path.Base(normalized)
}

func inferObjectKind(fileName string) string {
	name := strings.ToLower(fileName)
	switch {
	case strings.Contains(name, ".zip"), strings.Contains(name, ".rar"), strings.Contains(name, ".7z"),
		strings.Contains(name, ".tar"), strings.Contains(name, ".gz"):
		return "code_package"
	case strings.Contains(name, "需求规格说明"), strings.Contains(name, "软件需求"):
		return "srs"
	case strings.Contains(name, "系统规格"):
		return "system_spec"
	case strings.Contains(name, "研制总要求"):
		return "development_requirement"
	case strings.Contains(name, "研制任务书"), strings.Contains(name, "任务书"):
		return "task_book"
	case strings.Contains(name, "技术要求"):
		return "technical_requirement"
	case strings.Contains(name, "用户手册"), strings.Contains(name, "使用手册"):
		return "user_manual"
	default:
		return "other_reference"
	}
}

func inferObjectName(fileName string) string {
	name := strings.TrimSuffix(strings.TrimSpace(fileName), path.Ext(fileName))
	name = trailingVersion.ReplaceAllString(name, "")
	return strings.NewReplacer("_", " ", "-", " ").Replace(strings.TrimSpace(name))
}

func inferVersion(fileName string) string {
	match := versionPattern.FindString(fileName)
	if match == "" {
		return "V1.00"
	}
	return "V" + match[1:]
}

func inferPlatform(fileName string) string {
	name := strings.ToLower(fileName)
	if strings.Contains(name, "fpga") {
		return "fpga"
	}
	if strings.Contains(name, "cpu") {
		return "cpu"
	}
	return "common"
}

func fileExtension(fileName string) string {
	extension := strings.ToLower(strings.TrimPrefix(path.Ext(fileName), "."))
	if !fileExtensionPattern.MatchString(extension) {
		return "bin"
	}
	return extension
}

func normalizePlatform(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "cpu":
		return "cpu"
	case "fpga":
		return "fpga"
	default:
		return "common"
	}
}

func normalizeVersion(value string) (string, error) {
	match := normalizedVersionPattern.FindStringSubmatch(strings.TrimSpace(value))
	if match == nil {
		return "", ErrInvalidVersion
	}
	return "V" + match[1], nil
}

func validateObject(objectKind string, objectName string) error {
	switch objectKind {
	case "srs", "system_spec", "development_requirement", "task_book", "technical_requirement",
		"user_manual", "code_package", "other_reference":
	default:
		return fmt.Errorf("工作对象类型不支持")
	}
	if strings.TrimSpace(objectName) == "" {
		return fmt.Errorf("对象名称不能为空")
	}
	return nil
}

func validateReceiveInfo(source string, receivedAt string, receiveMode string) error {
	if strings.TrimSpace(source) == "" {
		return fmt.Errorf("提供方不能为空")
	}
	if _, err := time.Parse("2006-01-02", receivedAt); err != nil {
		return fmt.Errorf("接收日期格式应为 YYYY-MM-DD")
	}
	switch receiveMode {
	case "email", "onsite", "platform", "other":
	default:
		return fmt.Errorf("接收方式不支持")
	}
	return nil
}

func validateReason(reason string) error {
	if len([]rune(reason)) > 2000 {
		return fmt.Errorf("操作原因不能超过 2000 字")
	}
	return nil
}
