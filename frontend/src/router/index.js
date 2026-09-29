// راوتر التنقل - Morix Platform
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

const routes = [
  {
    path: '/',
    redirect: () => {
      const auth = useAuthStore()
      if (!auth.isLoggedIn) return '/login'
      return auth.getRedirectPath(auth.user?.role)
    }
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { public: true }
  },
  {
    path: '/manager',
    name: 'Manager',
    component: () => import('../views/ManagerDashboard.vue'),
    meta: { requiresAuth: true, roles: ['manager', 'admin', 'owner'] }
  },
  {
    path: '/student',
    name: 'Student',
    component: () => import('../views/StudentHub.vue'),
    meta: { requiresAuth: true, roles: ['student', 'owner'] }
  },
  {
    path: '/teacher',
    name: 'Teacher',
    component: () => import('../views/TeacherHub.vue'),
    meta: { requiresAuth: true, roles: ['teacher', 'owner'] }
  },
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('../views/AdminHub.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'owner'] }
  },
  {
    path: '/owner',
    name: 'Owner',
    component: () => import('../views/OwnerHub.vue'),
    meta: { requiresAuth: true, roles: ['owner'] }
  },
  {
    path: '/about',
    name: 'About',
    component: () => import('../views/AboutUs.vue'),
    meta: { public: true }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/login'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const auth = useAuthStore()

  if (to.meta.public) {
    if (auth.isLoggedIn && to.name === 'Login') {
      return next(auth.getRedirectPath(auth.user?.role))
    }
    return next()
  }

  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return next('/login')
  }

  if (to.meta.roles && !to.meta.roles.includes(auth.user?.role)) {
    return next(auth.getRedirectPath(auth.user?.role))
  }

  next()
})

export default router
