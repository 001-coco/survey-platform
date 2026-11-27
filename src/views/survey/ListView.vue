<template>
  <div class="page">
    <div class="toolbar">
      <el-input
        v-model="query.keyword"
        placeholder="搜索标题"
        clearable
        style="width: 200px"
        @input="onKeywordInput"
        @keyup.enter="onSearchNow"
      />
      <el-select v-model="query.status" placeholder="状态" clearable style="width: 140px" @change="onFilterChange">
        <el-option label="草稿" value="draft" />
        <el-option label="已发布" value="published" />
        <el-option label="已停止" value="stopped" />
      </el-select>
      <el-button type="primary" @click="$router.push('/editor')">新建问卷</el-button>
    </div>

    <el-table :data="list" v-loading="loading" border>
      <el-table-column prop="title" label="标题" min-width="180" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="answerCount" label="回收量" width="90" />
      <el-table-column label="更新时间" width="180">
        <template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="320">
        <template #default="{ row }">
          <el-button link @click="$router.push(`/editor/${row.id}`)">编辑</el-button>
          <el-button link @click="handleToggle(row)">{{ row.status === 'published' ? '停止' : '发布' }}</el-button>
          <el-button link @click="$router.push(`/stats/${row.id}`)">数据</el-button>
          <el-button link @click="copyLink(row)">复制链接</el-button>
          <el-button link type="danger" v-permission="'admin'" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      style="margin-top: 12px; justify-content: flex-end"
      layout="total, prev, pager, next"
      :total="total"
      :current-page="query.page"
      :page-size="query.size"
      @current-change="handlePageChange"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from  'element-plus'
import { getSurveyList, deleteSurvey, togglePublish } from '@/api/survey'
import { debounce } from '@/core'

const loading = ref(false)
const list = ref([])
const total = ref(0)
const query = reactive({ page: 1, size: 10, keyword: '', status: '' })

/* ---------- 请求缓存：相同查询参数 30s 内直接命中 ---------- */
const CACHE_TTL = 30 * 1000
const listCache = new Map() // key -> { time, data }

/** key 用固定顺序拼接，避免对象序列化顺序不同导致命中率下降 */
function cacheKey() {
  // 带上用户名：否则同页面换账号后会命中上一个人的列表
  return [localStorage.getItem('username') || '', query.page, query.size, query.keyword.trim(), query.status].join('|')
}

/** 任何写操作后列表都会失真，直接清空缓存（比精确失效简单且不会错） */
function invalidateCache() {
  listCache.clear()
}

async function load() {
  const key = cacheKey()
  const hit = listCache.get(key)
  if (hit && Date.now() - hit.time < CACHE_TTL) {
    list.value = hit.data.list
    total.value = hit.data.total
    return
  }

  loading.value = true
  try {
    const data = await getSurveyList(query)
    list.value = data.list
    total.value = data.total
    listCache.set(key, { time: Date.now(), data })
  } finally {
    loading.value = false
  }
}

/* ---------- 搜索防抖：使用 core/ 里手写的 debounce ---------- */
const loadDebounced = debounce(() => {
  query.page = 1
  load()
}, 300)

function onKeywordInput() {
  loadDebounced()
}

function onSearchNow() {
  loadDebounced.cancel() // 立刻搜索时取消挂起的防抖，避免多打一次请求
  query.page = 1
  load()
}

function onFilterChange() {
  query.page = 1
  load()
}

function handlePageChange(page) {
  query.page = page
  load()
}

async function handleToggle(row) {
  await togglePublish(row.id)
  ElMessage.success('状态已更新')
  invalidateCache()
  load()
}

async function handleDelete(row) {
  await ElMessageBox.confirm(`确认删除「${row.title}」？`, '提示', { type: 'warning' })
  await deleteSurvey(row.id)
  ElMessage.success('已删除')
  invalidateCache()
  load()
}

function copyLink(row) {
  const url = `${window.location.origin}${window.location.pathname}#/fill/${row.id}`
  navigator.clipboard?.writeText(url)
  ElMessage.success('填写链接已复制')
}

const statusText = (status) => ({ draft: '草稿', published: '已发布', stopped: '已停止' }[status] || status)
const statusType = (status) => ({ draft: 'info', published: 'success', stopped: 'danger' }[status] || 'info')

function formatTime(ts) {
  if (!ts) return '-'
  return new Date(ts).toLocaleString('zh-CN')
}

onMounted(load)

// 组件卸载时清掉未执行的防抖定时器，避免卸载后仍触发一次请求
onBeforeUnmount(() => loadDebounced.cancel())
</script>

<style scoped>
.toolbar { display: flex; gap: 8px; margin-bottom: 12px; }
</style>
