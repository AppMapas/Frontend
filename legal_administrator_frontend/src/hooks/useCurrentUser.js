import { reactive } from 'vue'

const currentUser = reactive({
  id: 1,
  name: 'Administrador',
  role: 'Super Admin',
  email: 'admin@legaladministrator.com',
  avatarBg: 'var(--color-avatar-bg)',
  permissions: ['ADMIN', 'READ', 'WRITE', 'EXPORT']
})

export function useCurrentUser() {
  return {
    currentUser
  }
}
