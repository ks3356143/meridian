package auth

import (
	"fmt"

	"github.com/casbin/casbin/v2"
	"github.com/casbin/casbin/v2/model"
)

const rbacModel = `
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = r.sub == p.sub && keyMatch(r.obj, p.obj) && (r.act == p.act || p.act == "*")
`

func newEnforcer() (*casbin.Enforcer, error) {
	casbinModel, err := model.NewModelFromString(rbacModel)
	if err != nil {
		return nil, fmt.Errorf("初始化 Casbin 模型失败: %w", err)
	}

	enforcer, err := casbin.NewEnforcer(casbinModel)
	if err != nil {
		return nil, fmt.Errorf("初始化 Casbin 执行器失败: %w", err)
	}

	policies := [][]string{
		{"admin", "/api/v1/*", "*"},
		{"tester", "/api/v1/*", "GET"},
		{"viewer", "/api/v1/*", "GET"},
	}
	for _, policy := range policies {
		if _, err := enforcer.AddPolicy(policy[0], policy[1], policy[2]); err != nil {
			return nil, fmt.Errorf("写入 Casbin 策略失败: %w", err)
		}
	}
	return enforcer, nil
}
