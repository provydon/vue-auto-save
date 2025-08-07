import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reactive, nextTick } from 'vue';
import { useAutoSaveForm } from '../src';

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
}); 