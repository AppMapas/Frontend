import { defineStore } from 'pinia'

export const useNotificationStore = defineStore('notifications', {
  state: () => ({ current: null, sequence: 0 }),
  actions: {
    show(message, tone = 'info', actionLabel = '', action = null) {
      this.sequence += 1
      this.current = { id: this.sequence, message, tone, actionLabel, action }
    },
    close() {
      this.current = null
    },
    async runAction() {
      const action = this.current?.action
      this.close()
      if (action) await action()
    },
  },
})
