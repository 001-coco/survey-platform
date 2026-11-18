import { defineStore } from 'pinia'
import { login as loginApi } from '@/api/auth'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    username: localStorage.getItem('username') || '',
    role: localStorage.getItem('role') || ''
  }),
  getters: {
    isLogin: (state) => !!state.token,
    isAdmin: (state) => state.role === 'admin'
  },
  actions: {
    async login(form) {
      const { token, refreshToken, user } = await loginApi(form)
      this.token = token
      this.username = user.username
      this.role = user.role

      localStorage.setItem('token', token)
      // refreshToken 只用于换取新的 accessToken，不参与接口鉴权
      localStorage.setItem('refreshToken', refreshToken)
      localStorage.setItem('username', user.username)
      localStorage.setItem('role', user.role)
    },
    logout() {
      this.token = ''
      this.username = ''
      this.role = ''
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('username')
      localStorage.removeItem('role')
    }
  }
})
