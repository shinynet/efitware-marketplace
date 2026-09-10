import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import WorkoutApp from './WorkoutApp.vue'
import { messages } from './messages'
import './styles.css'

createApp(WorkoutApp).use(createI18n({ legacy: false, locale: navigator.language.startsWith('de') ? 'de' : 'en', fallbackLocale: 'en', messages })).mount('#app')
