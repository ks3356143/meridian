package projects

import (
	"context"
	"fmt"
	"strings"

	"chenmeridian/internal/modules/users"
)

func (s *Service) buildResponses(ctx context.Context, allProjects []Project) ([]ProjectResponse, error) {
	if len(allProjects) == 0 {
		return []ProjectResponse{}, nil
	}
	projectIDs := make([]string, 0, len(allProjects))
	for _, project := range allProjects {
		projectIDs = append(projectIDs, project.ID)
	}

	allUsers, err := s.repository.ListUsers(ctx)
	if err != nil {
		return nil, fmt.Errorf("查询项目人员失败: %w", err)
	}
	usersByID := make(map[string]users.User, len(allUsers))
	for _, user := range allUsers {
		usersByID[user.ID] = user
	}

	members, err := s.repository.ListProjectMembers(ctx, projectIDs)
	if err != nil {
		return nil, fmt.Errorf("查询项目成员失败: %w", err)
	}
	membersByProject := make(map[string][]ProjectMemberResponse)
	for _, member := range members {
		user := usersByID[member.UserID]
		membersByProject[member.ProjectID] = append(membersByProject[member.ProjectID], ProjectMemberResponse{
			ID:          user.ID,
			Username:    user.Username,
			DisplayName: user.DisplayName,
			IsOwner:     member.IsOwner,
		})
	}

	dictionaries, err := s.repository.ListProjectDictionaries(ctx, projectIDs)
	if err != nil {
		return nil, fmt.Errorf("查询项目技术字典失败: %w", err)
	}
	dictionariesByProject := make(map[string]map[string][]string)
	for _, item := range dictionaries {
		values := dictionariesByProject[item.ProjectID]
		if values == nil {
			values = make(map[string][]string)
			dictionariesByProject[item.ProjectID] = values
		}
		values[item.Category] = append(values[item.Category], item.Name)
	}

	standards, err := s.repository.ListProjectStandards(ctx, projectIDs)
	if err != nil {
		return nil, fmt.Errorf("查询项目依据标准失败: %w", err)
	}
	standardsByProject := make(map[string][]ReferenceStandardResponse)
	for _, standard := range standards {
		standardsByProject[standard.ProjectID] = append(standardsByProject[standard.ProjectID], ReferenceStandardResponse{
			ID:            standard.ID,
			Name:          standard.Name,
			Code:          standard.Code,
			PublishedDate: standard.PublishedDate,
			Source:        standard.Source,
			SortOrder:     standard.SortOrder,
			IsEnabled:     standard.IsEnabled,
			IsDefault:     standard.IsDefault,
		})
	}

	responses := make([]ProjectResponse, 0, len(allProjects))
	for _, project := range allProjects {
		owner := usersByID[project.OwnerID]
		ownerName := owner.DisplayName
		if ownerName == "" {
			ownerName = owner.Username
		}
		dictionaryValues := dictionariesByProject[project.ID]
		members := membersByProject[project.ID]
		if members == nil {
			members = []ProjectMemberResponse{}
		}
		projectStandards := standardsByProject[project.ID]
		if projectStandards == nil {
			projectStandards = []ReferenceStandardResponse{}
		}

		responses = append(responses, ProjectResponse{
			ID:                      project.Code,
			Name:                    project.Name,
			Nature:                  project.Nature,
			Platform:                project.Platform,
			SoftwareType:            project.SoftwareType,
			Classification:          project.Classification,
			Level:                   project.SecurityLevel,
			Organization:            project.Organization,
			Owner:                   ownerName,
			Members:                 members,
			Languages:               nonNilStrings(dictionaryValues["language"]),
			RuntimeEnvironments:     nonNilStrings(dictionaryValues["runtime_environment"]),
			DevelopmentEnvironments: nonNilStrings(dictionaryValues["development_environment"]),
			ReferenceStandards:      projectStandards,
			CasesTotal:              project.CasesTotal,
			CasesExecuted:           project.CasesExecuted,
			OpenIssues: OpenIssues{
				Critical:   project.CriticalIssues,
				Serious:    project.SeriousIssues,
				Normal:     project.NormalIssues,
				Suggestion: project.SuggestionIssues,
			},
			Status:    project.Status,
			UpdatedAt: project.UpdatedAt.Format("2006-01-02 15:04"),
		})
	}
	return responses, nil
}

func toStandardResponse(standard ReferenceStandard) ReferenceStandardResponse {
	return ReferenceStandardResponse{
		ID:            standard.ID,
		Name:          standard.Name,
		Code:          standard.Code,
		PublishedDate: standard.PublishedDate,
		Source:        standard.Source,
		SortOrder:     standard.SortOrder,
		IsEnabled:     standard.IsEnabled,
		IsDefault:     standard.IsDefault,
	}
}

func nonNilStrings(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}

func uniqueStrings(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}
