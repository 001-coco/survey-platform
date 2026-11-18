import request from './request'

/** 问卷列表（分页 + 搜索 + 状态筛选） */
export function getSurveyList(params) {
  return request.get('/surveys', { params })
}

export function getSurvey(id) {
  return request.get(`/surveys/${id}`)
}

export function createSurvey(data) {
  return request.post('/surveys', data)
}

export function updateSurvey(id, data) {
  return request.put(`/surveys/${id}`, data)
}

export function deleteSurvey(id) {
  return request.delete(`/surveys/${id}`)
}

/** 发布 / 停止（后端做状态翻转） */
export function togglePublish(id) {
  return request.post(`/surveys/${id}/publish`)
}

export function getAnswers(id) {
  return request.get(`/surveys/${id}/answers`)
}

export function getStats(id) {
  return request.get(`/surveys/${id}/stats`)
}

/* ------- 填写端公开接口（不带 token，走 /api/public） ------- */
export function getPublicSurvey(id) {
  return request.get(`/public/surveys/${id}`)
}

export function submitAnswer(id, data) {
  return request.post(`/surveys/${id}/answers`, { data })
}
