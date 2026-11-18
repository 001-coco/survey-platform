<template>
  <!-- 按需引入后 Element Plus 不再全局安装，语言包通过 ConfigProvider 下发 -->
  <el-config-provider :locale="zhCn">
    <router-view />
  </el-config-provider>
</template>

<script setup>
import zhCn from 'element-plus/es/locale/lang/zh-cn'
</script>
