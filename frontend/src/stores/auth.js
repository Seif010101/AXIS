// مخزن المصادقة - Morix Platform
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authAPI } from '../api.js'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('memorix_token') || null)
  const user = ref(JSON.parse(localStorage.getItem('memorix_user') || 'null'))
  const loading = ref(false)
  const error = ref(null)

  const isLoggedIn = computed(() => !!token.value && !!user.value)
  const isManager = computed(() => user.value?.role === 'manager')
  const isAdmin = computed(() => user.value?.role === 'admin')
  const isTeacher = computed(() => user.value?.role === 'teacher')
  const isStudent = computed(() => user.value?.role === 'student')
  const isOwner = computed(() => user.value?.role === 'owner')
  const isManagerOrAdmin = computed(() => ['manager', 'admin', 'owner'].includes(user.value?.role))

  function getRedirectPath(role) {
    if (role === 'owner') return '/owner'
    if (role === 'teacher') return '/teacher'
    if (role === 'manager') return '/manager'
    if (role === 'admin') return '/admin'
    if (role === 'student') return '/student'
    return '/login'
  }

  async function login(email, password) {
    loading.value = true
    error.value = null
    try {
      const res = await authAPI.login(email, password)
      token.value = res.data.access_token
      user.value = res.data.user

      localStorage.setItem('memorix_token', token.value)
      localStorage.setItem('memorix_user', JSON.stringify(user.value))

      return { success: true, role: user.value.role, redirect: getRedirectPath(user.value.role) }
    } catch (err) {
      error.value = err.response?.data?.detail || 'خطأ في تسجيل الدخول'
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    try { await authAPI.logout() } catch {}
    token.value = null
    user.value = null
    localStorage.removeItem('memorix_token')
    localStorage.removeItem('memorix_user')
  }

  function updateUser(newData) {
    user.value = { ...user.value, ...newData }
    localStorage.setItem('memorix_user', JSON.stringify(user.value))
  }

  return {
    token, user, loading, error,
    isLoggedIn, isManager, isAdmin, isTeacher, isStudent, isOwner, isManagerOrAdmin,
    login, logout, updateUser, getRedirectPath
  }
})
