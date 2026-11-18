<template>
  <div class="editor__panel editor__props">
    <h3>属性</h3>
    <p v-if="!question" class="hint">选中一道题后在此配置</p>

    <template v-if="question">
      <el-form label-position="top" size="small">
        <el-form-item label="题目标题">
          <el-input :model-value="question.title" @update:model-value="update('title', $event)" />
        </el-form-item>

        <el-form-item label="题型">
          <el-select :model-value="question.type" disabled>
            <el-option v-for="item in WIDGET_TYPES" :key="item.type" :label="item.label" :value="item.type" />
          </el-select>
        </el-form-item>

        <el-form-item label="必填">
          <el-switch :model-value="question.required" @update:model-value="update('required', $event)" />
        </el-form-item>

        <el-form-item v-if="question.type === 'input' || question.type === 'textarea'" label="占位提示">
          <el-input :model-value="question.placeholder" @update:model-value="update('placeholder', $event)" />
        </el-form-item>

        <!-- 选项编辑（单选 / 多选） -->
        <el-form-item v-if="question.options" label="选项">
          <div v-for="(opt, i) in question.options" :key="opt.value" class="opt-row">
            <el-input
              :model-value="opt.label"
              @update:model-value="updateOptionLabel(i, $event)"
            />
            <el-button link type="danger" @click="removeOption(i)">删除</el-button>
          </div>
          <el-button size="small" @click="addOption">+ 添加选项</el-button>
        </el-form-item>

        <!-- 逻辑：条件显示 -->
        <el-divider content-position="left">显示逻辑</el-divider>
        <el-form-item label="依赖题目">
          <el-select
            :model-value="question.condition?.dependsOn || ''"
            clearable
            placeholder="不限制"
            @update:model-value="setConditionField('dependsOn', $event)"
          >
            <el-option
              v-for="item in availableDepends"
              :key="item.id"
              :label="item.title"
              :value="item.id"
            />
          </el-select>
        </el-form-item>

        <template v-if="question.condition">
          <el-form-item label="条件">
            <el-select
              :model-value="question.condition.operator"
              @update:model-value="setConditionField('operator', $event)"
            >
              <el-option label="等于" value="eq" />
              <el-option label="不等于" value="neq" />
              <el-option label="已填写" value="notEmpty" />
              <el-option label="未填写" value="empty" />
            </el-select>
          </el-form-item>

          <el-form-item v-if="['eq', 'neq'].includes(question.condition.operator)" label="比较值">
            <el-select
              v-if="dependsOptions.length"
              :model-value="question.condition.value"
              @update:model-value="setConditionField('value', $event)"
            >
              <el-option v-for="o in dependsOptions" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
            <el-input
              v-else
              :model-value="question.condition.value"
              @update:model-value="setConditionField('value', $event)"
            />
          </el-form-item>
        </template>
      </el-form>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { WIDGET_TYPES, createId } from './widgets'

const props = defineProps({
  question: { type: Object, default: null },
  questions: { type: Array, default: () => [] }
})

const emit = defineEmits(['beforeEdit'])

/**
 * 只允许依赖「排在自己前面的题」。
 * 这样依赖图天然是有向无环的（DAG），不会出现循环引用。
 * 面试可补充：如果放开顺序限制，需要在保存时做环检测（DFS 三色标记法）。
 */
const availableDepends = computed(() => {
  if (!props.question) return []
  const index = props.questions.findIndex((q) => q.id === props.question.id)
  return props.questions.slice(0, index === -1 ? props.questions.length : index)
})

const dependsOptions = computed(() => {
  if (!props.question?.condition) return []
  const target = props.questions.find((q) => q.id === props.question.condition.dependsOn)
  return target?.options || []
})

function update(key, value) {
  emit('beforeEdit') // 通知父组件先记录历史快照
  props.question[key] = value
}

function addOption() {
  emit('beforeEdit')
  props.question.options.push({ label: `选项 ${props.question.options.length + 1}`, value: createId('o') })
}

function updateOptionLabel(index, value) {
  emit('beforeEdit')
  props.question.options[index].label = value
}

function removeOption(index) {
  emit('beforeEdit')
  props.question.options.splice(index, 1)
}

function setConditionField(field, value) {
  emit('beforeEdit')
  const condition = props.question.condition || { dependsOn: '', operator: 'eq', value: '' }
  condition[field] = value

  // 清空依赖题时移除整个条件
  if (field === 'dependsOn' && !value) {
    props.question.condition = null
    return
  }
  props.question.condition = { ...condition }
}
</script>

<style scoped>
h3 { margin: 0 0 4px; font-size: 14px; }
.hint { font-size: 12px; color: #909399; }
.opt-row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
</style>
