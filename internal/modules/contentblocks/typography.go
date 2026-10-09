package contentblocks

// 中文字号 ↔ 磅值（GB/T 标准）。Word 与 OfficeCLI 只认磅值，
// 生成侧、排版 lint 和 SRS 里的字号口径都必须查这张表，禁止散写 10.5 / 12 这类魔法数字。
var chineseFontSizePoints = map[string]float64{
	"初号": 42, "小初": 36,
	"一号": 26, "小一": 24,
	"二号": 22, "小二": 18,
	"三号": 16, "小三": 15,
	"四号": 14, "小四": 12,
	"五号": 10.5, "小五": 9,
	"六号": 7.5, "小六": 6.5,
	"七号": 5.5, "八号": 5,
}

// 正文与表格的固定字号口径，见《需求正文块模型》。
const (
	BodyFontSizeName  = "小四"
	TableFontSizeName = "五号"
)

// ChineseFontSizePoints 查询中文字号对应的磅值。
func ChineseFontSizePoints(name string) (float64, bool) {
	points, ok := chineseFontSizePoints[name]
	return points, ok
}

// BodyFontSizePoints / TableFontSizePoints 返回正文与表格的标准磅值。
func BodyFontSizePoints() float64  { return chineseFontSizePoints[BodyFontSizeName] }
func TableFontSizePoints() float64 { return chineseFontSizePoints[TableFontSizeName] }
