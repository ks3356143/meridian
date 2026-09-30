package contentblocks

import (
	"bytes"
	"fmt"
	"image"
	_ "image/gif"
	"image/jpeg"
	"image/png"

	xdraw "golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

// imageDimensions 读取图片像素尺寸。
func imageDimensions(data []byte) (int, int, error) {
	config, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return 0, 0, fmt.Errorf("读取图片尺寸失败: %w", err)
	}
	return config.Width, config.Height, nil
}

// CreateThumbnail 按最大宽度生成缩略图；原图不宽于目标时返回 generated=false。
func CreateThumbnail(data []byte, mimeType string, maxWidth int) ([]byte, string, bool, error) {
	if maxWidth <= 0 {
		return data, mimeType, false, nil
	}
	width, configHeight, err := imageDimensions(data)
	if err != nil {
		return data, mimeType, false, err
	}
	if width <= maxWidth {
		return data, mimeType, false, nil
	}

	source, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return data, mimeType, false, fmt.Errorf("解码图片失败: %w", err)
	}

	height := int(float64(configHeight) * float64(maxWidth) / float64(width))
	if height < 1 {
		height = 1
	}
	target := image.NewRGBA(image.Rect(0, 0, maxWidth, height))
	// ApproxBiLinear 在缩略图质量和 CPU 成本之间更符合详情滚动场景。
	xdraw.ApproxBiLinear.Scale(target, target.Bounds(), source, source.Bounds(), xdraw.Over, nil)

	var output bytes.Buffer
	switch mimeType {
	case "image/jpeg":
		if err := jpeg.Encode(&output, target, &jpeg.Options{Quality: 82}); err != nil {
			return data, mimeType, false, fmt.Errorf("编码 JPEG 缩略图失败: %w", err)
		}
		return output.Bytes(), "image/jpeg", true, nil
	default:
		if err := png.Encode(&output, target); err != nil {
			return data, mimeType, false, fmt.Errorf("编码 PNG 缩略图失败: %w", err)
		}
		return output.Bytes(), "image/png", true, nil
	}
}
