# useAutoSaveForm

A powerful Vue 3 composable that automatically saves form data with intelligent debouncing, field filtering, and lifecycle hooks.

[![npm version](https://img.shields.io/npm/v/@provydon/vue-auto-save.svg)](https://www.npmjs.com/package/@provydon/vue-auto-save)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 🚀 **Auto-save on change** with configurable debounce
- 🎯 **Smart field filtering** - skip Inertia helpers or custom fields
- 🛡️ **Blockable watchers** - pause auto-save during initialization
- 🔄 **Lifecycle hooks** - beforeSave, afterSave, onError callbacks
- 🎛️ **Custom serialization** - support for circular references and functions
- 🧪 **Custom comparators** - shallow/deep equality without stringification
- 🧹 **Automatic cleanup** - no memory leaks on component unmount
- 📦 **Framework agnostic** - works with Axios, Inertia, Fetch, etc.

## 🚀 Quick Start

```bash
npm install @provydon/vue-auto-save
```

```vue
<script setup>
import { reactive } from 'vue'
import { useAutoSaveForm } from '@provydon/vue-auto-save'

const form = reactive({
  title: '',
  content: '',
  tags: []
})

const { isAutoSaving } = useAutoSaveForm(form, {
  onSave: async () => {
    await axios.post('/api/posts', form)
  },
  debounce: 2000,
  debug: true
})
</script>

<template>
  <form>
    <input v-model="form.title" placeholder="Post title" />
    <textarea v-model="form.content" placeholder="Post content" />
    <div v-if="isAutoSaving">Saving...</div>
  </form>
</template>
```

## 📖 API Reference

### Basic Usage

```ts
const { isAutoSaving, blockWatcher, unblockWatcher, stop } = useAutoSaveForm(
  form, // reactive object or ref
  options
)
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `onSave` | `() => void \| Promise<void>` | **Required** | Function called when auto-save should trigger |
| `debounce` | `number` | `3000` | Delay in milliseconds before saving |
| `skipFields` | `string[]` | `[]` | Field names to exclude from tracking |
| `skipInertiaFields` | `boolean` | `true` | Skip common Inertia.js form helpers |
| `deep` | `boolean` | `true` | Deep watch the form object |
| `debug` | `boolean` | `false` | Enable console logging |
| `saveOnInit` | `boolean` | `false` | Save immediately on mount |
| `serialize` | `(obj) => string` | `JSON.stringify` | Custom serialization function |
| `compare` | `(a, b) => boolean` | `undefined` | Custom comparison function |
| `onBeforeSave` | `() => void` | `undefined` | Called before saving |
| `onAfterSave` | `() => void` | `undefined` | Called after successful save |
| `onError` | `(err) => void` | `undefined` | Called on save error |

### Return Values

| Property | Type | Description |
|----------|------|-------------|
| `isAutoSaving` | `Ref<boolean>` | Reactive boolean indicating save status |
| `blockWatcher` | `(ms?: number) => void` | Temporarily block auto-save |
| `unblockWatcher` | `(ms?: number \| null) => void` | Unblock and optionally save immediately |
| `stop` | `() => void` | Manually stop the watcher |

## 🎯 Examples

### With Inertia.js

```ts
import { useForm } from '@inertiajs/vue3'
import { useAutoSaveForm } from '@provydon/vue-auto-save'

const form = useForm({
  title: '',
  content: '',
  published: false
})

const { isAutoSaving } = useAutoSaveForm(form, {
  onSave: () => form.post('/posts', { preserveState: true }),
  skipInertiaFields: true, // Skips processing, errors, etc.
  debounce: 1000
})
```

### Custom Serialization

```ts
const { isAutoSaving } = useAutoSaveForm(form, {
  onSave: saveToAPI,
  serialize: (obj) => {
    // Handle circular references or functions
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'function') return '[Function]'
      return value
    })
  }
})
```

### Custom Comparator

```ts
import { isEqual } from 'lodash-es'

const { isAutoSaving } = useAutoSaveForm(form, {
  onSave: saveToAPI,
  compare: (a, b) => isEqual(a, b), // Deep equality without stringification
  serialize: undefined // Not used when compare is provided
})
```

### Block During Initialization

```ts
const { isAutoSaving, blockWatcher } = useAutoSaveForm(form, {
  onSave: saveToAPI,
  saveOnInit: false
})

// Block auto-save during form initialization
blockWatcher(5000) // Block for 5 seconds

// Or block indefinitely and unblock manually
blockWatcher()
// ... do initialization work ...
unblockWatcher() // Resume auto-save
```

### With Ref Forms

```ts
const form = ref({
  name: '',
  email: ''
})

const { isAutoSaving } = useAutoSaveForm(form, {
  onSave: saveToAPI
})
```

## 🔧 Advanced Usage

### Lifecycle Hooks

```ts
const { isAutoSaving } = useAutoSaveForm(form, {
  onSave: saveToAPI,
  onBeforeSave: () => {
    console.log('About to save...')
  },
  onAfterSave: () => {
    console.log('Save completed!')
  },
  onError: (error) => {
    console.error('Save failed:', error)
  }
})
```

### Manual Control

```ts
const { isAutoSaving, stop } = useAutoSaveForm(form, {
  onSave: saveToAPI
})

// Manually stop the watcher
stop()

// The watcher will also stop automatically on component unmount
```

## 🎨 Styling Examples

### Loading Indicator

```vue
<template>
  <div class="form-container">
    <input v-model="form.title" />
    <div v-if="isAutoSaving" class="save-indicator">
      <span class="spinner"></span>
      Auto-saving...
    </div>
  </div>
</template>

<style scoped>
.save-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #666;
  font-size: 14px;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #ddd;
  border-top: 2px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
```

## 🚨 Important Notes

- **Circular References**: `JSON.stringify` (default serializer) will throw on circular references. Use a custom `serialize` function if needed.
- **Functions**: Functions won't survive `JSON.stringify`. Use custom serialization for function-heavy forms.
- **Vue Version**: Requires Vue 3.2+ (supports both reactive objects and refs).
- **Cleanup**: Watchers and timers are automatically cleaned up on component unmount.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT © [Providence Ifeosame](https://github.com/provydon)

## 🙏 Support

If you find this package helpful, consider:
- ⭐ Starring the repository
- 🐛 Reporting bugs
- 💡 Suggesting features
- ☕ [Buying me a coffee](https://buymeacoffee.com/provydon)

Follow me on [Twitter](https://x.com/ProvyDon1) or connect on [LinkedIn](https://www.linkedin.com/in/providence-ifeosame/).
