package contentblocks

import "testing"

func TestChineseFontSizePoints(t *testing.T) {
	cases := map[string]float64{
		"初号": 42, "一号": 26, "二号": 22, "三号": 16, "四号": 14,
		"小四": 12, "五号": 10.5, "小五": 9, "六号": 7.5, "七号": 5.5, "八号": 5,
	}
	for name, want := range cases {
		got, ok := ChineseFontSizePoints(name)
		if !ok || got != want {
			t.Fatalf("字号 %s 应为 %vpt，实际 %v (存在=%v)", name, want, got, ok)
		}
	}
	if _, ok := ChineseFontSizePoints("小四号"); ok {
		t.Fatal("未定义字号不应命中映射")
	}
	if BodyFontSizePoints() != 12 || TableFontSizePoints() != 10.5 {
		t.Fatalf("正文字号应为小四 12pt、表格应为五号 10.5pt，实际 %v / %v",
			BodyFontSizePoints(), TableFontSizePoints())
	}
}
