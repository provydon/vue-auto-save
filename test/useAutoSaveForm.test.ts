import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reactive, nextTick } from 'vue';
import { useAutoSaveForm } from '../src';
import { ref } from 'vue';

describe('useAutoSaveForm', () => {
  let mockOnSave: ReturnType<typeof vi.fn>;
  let mockOnBeforeSave: ReturnType<typeof vi.fn>;
  let mockOnAfterSave: ReturnType<typeof vi.fn>;
  let mockOnError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockOnSave = vi.fn();
    mockOnBeforeSave = vi.fn();
    mockOnAfterSave = vi.fn();
    mockOnError = vi.fn();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.clearAllMocks();
  });

  it('should initialize with default values', () => {
    const form = reactive({ name: '', email: '' });
    const { isAutoSaving } = useAutoSaveForm(form, { onSave: mockOnSave });

    expect(isAutoSaving.value).toBe(false);
  });

  it('should trigger save after debounce delay', async () => {
    const form = reactive({ name: 'John', email: 'john@example.com' });
    const { isAutoSaving } = useAutoSaveForm(form, { 
      onSave: mockOnSave,
      debounce: 1000 
    });

    form.name = 'Jane';
    await nextTick();

    expect(mockOnSave).not.toHaveBeenCalled();
    expect(isAutoSaving.value).toBe(false);

    vi.advanceTimersByTime(1000);
    await nextTick();

    expect(mockOnSave).toHaveBeenCalledTimes(1);
    expect(isAutoSaving.value).toBe(true);
  });

  it('should call lifecycle hooks in correct order', async () => {
    const form = reactive({ name: 'John' });
    const { isAutoSaving } = useAutoSaveForm(form, {
      onSave: mockOnSave,
      onBeforeSave: mockOnBeforeSave,
      onAfterSave: mockOnAfterSave,
      debounce: 100
    });

    form.name = 'Jane';
    await nextTick();

    vi.advanceTimersByTime(100);
    await nextTick();

    expect(mockOnBeforeSave).toHaveBeenCalled();
    expect(mockOnSave).toHaveBeenCalled();
    expect(mockOnAfterSave).toHaveBeenCalled();
  });

  it('should handle async save function', async () => {
    const asyncSave = vi.fn().mockResolvedValue(undefined);
    const form = reactive({ name: 'John' });
    const { isAutoSaving } = useAutoSaveForm(form, {
      onSave: asyncSave,
      debounce: 100
    });

    form.name = 'Jane';
    await nextTick();

    vi.advanceTimersByTime(100);
    await nextTick();

    expect(asyncSave).toHaveBeenCalledTimes(1);
    expect(isAutoSaving.value).toBe(true);
  });

  it('should handle save errors', async () => {
    const errorSave = vi.fn().mockRejectedValue(new Error('Save failed'));
    const form = reactive({ name: 'John' });
    const { isAutoSaving } = useAutoSaveForm(form, {
      onSave: errorSave,
      onError: mockOnError,
      debounce: 100
    });

    form.name = 'Jane';
    await nextTick();

    vi.advanceTimersByTime(100);
    await nextTick();

    expect(errorSave).toHaveBeenCalledTimes(1);
  });

  it('should skip specified fields', async () => {
    const form = reactive({ 
      name: 'John', 
      email: 'john@example.com',
      _method: 'POST',
      skipThis: 'value'
    });
    
    const { isAutoSaving } = useAutoSaveForm(form, {
      onSave: mockOnSave,
      skipFields: ['_method', 'skipThis'],
      debounce: 100
    });

    form._method = 'PUT';
    form.skipThis = 'new value';
    await nextTick();

    vi.advanceTimersByTime(100);
    await nextTick();

    expect(mockOnSave).not.toHaveBeenCalled();

    form.name = 'Jane';
    await nextTick();

    vi.advanceTimersByTime(100);
    await nextTick();

    expect(mockOnSave).toHaveBeenCalledTimes(1);
  });

  it('should skip Inertia fields by default', async () => {
    const form = reactive({ 
      name: 'John',
      processing: false,
      errors: {},
      data: {}
    });
    
    const { isAutoSaving } = useAutoSaveForm(form, {
      onSave: mockOnSave,
      debounce: 100
    });

    form.processing = true;
    form.errors = { name: ['Required'] };
    await nextTick();

    vi.advanceTimersByTime(100);
    await nextTick();

    expect(mockOnSave).not.toHaveBeenCalled();

    form.name = 'Jane';
    await nextTick();

    vi.advanceTimersByTime(100);
    await nextTick();

    expect(mockOnSave).toHaveBeenCalledTimes(1);
  });

  it('should block watcher temporarily', async () => {
    const form = reactive({ name: 'John' });
    const { isAutoSaving, blockWatcher } = useAutoSaveForm(form, {
      onSave: mockOnSave,
      debounce: 100
    });

    blockWatcher(500);

    form.name = 'Jane';
    await nextTick();

    vi.advanceTimersByTime(100);
    await nextTick();

    expect(mockOnSave).not.toHaveBeenCalled();

    vi.advanceTimersByTime(400);
    await nextTick();

    form.name = 'Bob';
    await nextTick();

    vi.advanceTimersByTime(100);
    await nextTick();

    expect(mockOnSave).toHaveBeenCalledTimes(1);
  });

  it('should handle deeply nested object changes', async () => {
    const form = reactive({ 
      user: { 
        profile: { 
          personal: { 
            name: 'John',
            details: { age: 30, preferences: { theme: 'dark' } }
          },
          contact: { email: 'john@example.com' }
        },
        settings: { notifications: { email: true, push: false } }
      },
      metadata: { 
        tags: ['user', 'active'],
        permissions: { read: true, write: false, admin: false }
      }
    });
    
    const { isAutoSaving } = useAutoSaveForm(form, {
      onSave: mockOnSave,
      deep: true,
      debounce: 100
    });

    form.user.profile.personal.name = 'Jane';
    await nextTick();

    vi.advanceTimersByTime(100);
    await nextTick();

    expect(mockOnSave).toHaveBeenCalledTimes(1);

    form.user.profile.personal.details.preferences.theme = 'light';
    await nextTick();

    vi.advanceTimersByTime(100);
    await nextTick();

    expect(mockOnSave).toHaveBeenCalledTimes(2);

    form.user.settings.notifications.push = true;
    await nextTick();

    vi.advanceTimersByTime(100);
    await nextTick();

    expect(mockOnSave).toHaveBeenCalledTimes(3);

    form.metadata.permissions.admin = true;
    await nextTick();

    vi.advanceTimersByTime(100);
    await nextTick();

    expect(mockOnSave).toHaveBeenCalledTimes(4);
  });

  it('should handle array mutations in deeply nested objects', async () => {
    const form = reactive({ 
      categories: [
        { 
          id: 1, 
          name: 'Electronics',
          products: [
            { id: 1, name: 'Phone', variants: [{ color: 'black', price: 999 }] }
          ]
        }
      ]
    });
    
    const { isAutoSaving } = useAutoSaveForm(form, {
      onSave: mockOnSave,
      deep: true,
      debounce: 100
    });

    form.categories[0].products[0].variants.push({ color: 'white', price: 1099 });
    await nextTick();

    vi.advanceTimersByTime(100);
    await nextTick();

    expect(mockOnSave).toHaveBeenCalledTimes(1);

    form.categories[0].products.push({ id: 2, name: 'Laptop', variants: [] });
    await nextTick();

    vi.advanceTimersByTime(100);
    await nextTick();

    expect(mockOnSave).toHaveBeenCalledTimes(2);
  });

  it('should handle nested and array changes reactively', async () => {
    const form = reactive({ 
      user: { name: 'John', address: { city: 'NYC' } },
      tags: ['vue', 'typescript'],
      items: [{ id: 1, name: 'Item 1' }]
    });
    
    const { isAutoSaving } = useAutoSaveForm(form, {
      onSave: mockOnSave,
      deep: true,
      debounce: 100
    });

    form.user.name = 'Jane';
    await nextTick();

    vi.advanceTimersByTime(100);
    await nextTick();

    expect(mockOnSave).toHaveBeenCalledTimes(1);

    form.user.address.city = 'LA';
    await nextTick();

    vi.advanceTimersByTime(100);
    await nextTick();

    expect(mockOnSave).toHaveBeenCalledTimes(2);

    form.tags.push('composable');
    await nextTick();

    vi.advanceTimersByTime(100);
    await nextTick();

    expect(mockOnSave).toHaveBeenCalledTimes(3);
  });

  it('should debounce rapid changes into one save', async () => {
    const form = reactive({ name: 'John' });
    const { isAutoSaving } = useAutoSaveForm(form, {
      onSave: mockOnSave,
      debounce: 200
    });

    form.name = 'Jane';
    await nextTick();

    vi.advanceTimersByTime(50);
    await nextTick();

    form.name = 'Bob';
    await nextTick();

    vi.advanceTimersByTime(50);
    await nextTick();

    form.name = 'Alice';
    await nextTick();

    vi.advanceTimersByTime(200);
    await nextTick();

    expect(mockOnSave).toHaveBeenCalledTimes(1);
  });

  it('should enable debug logging when debug is true', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const form = reactive({ name: 'John' });
    
    const { isAutoSaving } = useAutoSaveForm(form, {
      onSave: mockOnSave,
      debug: true,
      debounce: 100
    });

    form.name = 'Jane';
    await nextTick();

    vi.advanceTimersByTime(100);
    await nextTick();

    expect(consoleSpy).toHaveBeenCalledWith('[AutoSave] Detected changes. Saving...');
    expect(consoleSpy).toHaveBeenCalledWith('[AutoSave] Save successful.');

    consoleSpy.mockRestore();
  });

  it('should test deep reactivity with complex nested structures', async () => {
    const form = reactive({ 
      company: {
        departments: [
          {
            id: 1,
            name: 'Engineering',
            teams: [
              {
                id: 1,
                name: 'Frontend',
                members: [
                  { id: 1, name: 'Alice', skills: ['Vue', 'TypeScript'] }
                ]
              }
            ]
          }
        ]
      }
    });
    
    const { isAutoSaving } = useAutoSaveForm(form, {
      onSave: mockOnSave,
      deep: true,
      debounce: 100
    });

    form.company.departments[0].teams[0].members[0].skills.push('React');
    await nextTick();

    vi.advanceTimersByTime(100);
    await nextTick();

    expect(mockOnSave).toHaveBeenCalledTimes(1);

    form.company.departments[0].teams[0].members[0].name = 'Alice Smith';
    await nextTick();

    vi.advanceTimersByTime(100);
    await nextTick();

    expect(mockOnSave).toHaveBeenCalledTimes(2);
  });

  it('should detect changes in deeply nested arrays with object mutations', async () => {
    const form = reactive({ 
      projects: [
        {
          id: 1,
          tasks: [
            {
              id: 1,
              subtasks: [
                { id: 1, status: 'pending', assignee: { name: 'John', id: 1 } }
              ]
            }
          ]
        }
      ]
    });
    
    const { isAutoSaving } = useAutoSaveForm(form, {
      onSave: mockOnSave,
      deep: true,
      debounce: 100
    });

    form.projects[0].tasks[0].subtasks[0].status = 'in-progress';
    await nextTick();

    vi.advanceTimersByTime(100);
    await nextTick();

    expect(mockOnSave).toHaveBeenCalledTimes(1);

    form.projects[0].tasks[0].subtasks[0].assignee.name = 'Jane';
    await nextTick();

    vi.advanceTimersByTime(100);
    await nextTick();

    expect(mockOnSave).toHaveBeenCalledTimes(2);
  });

  it('should handle deep object property additions and deletions', async () => {
    const form = reactive({ 
      user: { 
        profile: { name: 'John' } as Record<string, any>
      }
    });
    
    const { isAutoSaving } = useAutoSaveForm(form, {
      onSave: mockOnSave,
      deep: true,
      debounce: 100
    });

    form.user.profile.email = 'john@example.com';
    await nextTick();

    vi.advanceTimersByTime(100);
    await nextTick();

    expect(mockOnSave).toHaveBeenCalledTimes(1);

    delete form.user.profile.email;
    await nextTick();

    vi.advanceTimersByTime(100);
    await nextTick();

    expect(mockOnSave).toHaveBeenCalledTimes(2);
  });



  it('should handle deep reactivity with mixed primitive and object types', async () => {
    const form = reactive({ 
      config: {
        enabled: true,
        settings: {
          theme: 'dark',
          features: {
            autoSave: true,
            notifications: false,
            advanced: {
              timeout: 5000,
              retries: 3
            }
          }
        }
      }
    });
    
    const { isAutoSaving } = useAutoSaveForm(form, {
      onSave: mockOnSave,
      deep: true,
      debounce: 100
    });

    form.config.settings.features.advanced.timeout = 10000;
    await nextTick();

    vi.advanceTimersByTime(100);
    await nextTick();

    expect(mockOnSave).toHaveBeenCalledTimes(1);

    form.config.settings.features.notifications = true;
    await nextTick();

    vi.advanceTimersByTime(100);
    await nextTick();

    expect(mockOnSave).toHaveBeenCalledTimes(2);

    form.config.enabled = false;
    await nextTick();

    vi.advanceTimersByTime(100);
    await nextTick();

    expect(mockOnSave).toHaveBeenCalledTimes(3);
  });

  it('should trigger immediate save when unblockWatcher is called with null', async () => {
    const form = reactive({ name: 'John', email: 'john@example.com' });
    const { isAutoSaving, unblockWatcher } = useAutoSaveForm(form, {
      onSave: mockOnSave,
      debounce: 1000
    });

    form.name = 'Jane';
    await nextTick();

    vi.advanceTimersByTime(500);
    await nextTick();

    expect(mockOnSave).not.toHaveBeenCalled();

    unblockWatcher(null);
    await nextTick();

    expect(mockOnSave).toHaveBeenCalledTimes(1);
    expect(isAutoSaving.value).toBe(true);
  });

  it('should trigger immediate save when unblockWatcher is called with null even without form changes', async () => {
    const form = reactive({ name: 'John', email: 'john@example.com' });
    const { isAutoSaving, unblockWatcher } = useAutoSaveForm(form, {
      onSave: mockOnSave,
      debounce: 1000
    });

    unblockWatcher(null);
    await nextTick();

    expect(mockOnSave).toHaveBeenCalledTimes(1);
    expect(isAutoSaving.value).toBe(true);
  });

  it('should trigger immediate save when unblockWatcher is called with null after blocking', async () => {
    const form = reactive({ name: 'John', email: 'john@example.com' });
    const { isAutoSaving, blockWatcher, unblockWatcher } = useAutoSaveForm(form, {
      onSave: mockOnSave,
      debounce: 1000
    });

    blockWatcher(5000);

    form.name = 'Jane';
    await nextTick();

    vi.advanceTimersByTime(1000);
    await nextTick();

    expect(mockOnSave).not.toHaveBeenCalled();

    unblockWatcher(null);
    await nextTick();

    expect(mockOnSave).toHaveBeenCalledTimes(1);
    expect(isAutoSaving.value).toBe(true);
  });

}); 