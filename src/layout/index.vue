<template>
  <div class="layout">
    <header class="layout__header">
      <div class="layout__logo">问卷平台</div>
      <div class="layout__user">
        <span>{{ userStore.username }}</span>
        <el-button link type="primary" @click="handleLogout">退出</el-button>
      </div>
    </header>

    <div class="layout__body">
      <aside class="layout__aside">
        <el-menu :default-active="activeMenu" router>
          <el-menu-item index="/surveys">问卷管理</el-menu-item>
        </el-menu>
      </aside>

      <main class="layout__main">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const activeMenu = computed(() => '/' + (route.path.split('/')[1] || 'surveys'))

function handleLogout() {
  userStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.layout { display: flex; flex-direction: column; height: 100%; }
.layout__header {
  height: 60px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}
.layout__logo { font-size: 18px; font-weight: 600; }
.layout__body { display: flex; flex: 1; overflow: hidden; }
.layout__aside { width: 180px; background: #fff; }
.layout__main { flex: 1; overflow: auto; }
</style>
