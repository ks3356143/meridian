package contentblocks

import "encoding/xml"

// decodeXML 统一 XML 解码入口，便于测试替换。
func decodeXML(data []byte, target any) error {
	return xml.Unmarshal(data, target)
}
