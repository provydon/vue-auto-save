import { ref, watch, isRef, unref, onScopeDispose, type Ref } from 'vue';

export interface UseAutoSaveFormOptions {
  /**
   * Delay in milliseconds before auto-saving after changes (default: 3000ms)
   */
  debounce?: number;

  /**
   * List of form field keys to exclude from tracking
   */
  skipFields?: string[];

  /**
   * Whether to skip common Inertia form fields (default: true)
   */
  skipInertiaFields?: boolean;

  /**
   * Whether to deeply watch the form (default: true)
   */
  deep?: boolean;

  /**
   * Enable debug logs in the console (default: false)
   */
  debug?: boolean;

  /**
   * Custom serializer function (default: JSON.stringify)
   * Note: Functions and non-serializable fields won't survive JSON.stringify.
   * Circular references will also cause JSON.stringify to throw.
   * Use a custom serializer if you need to handle these cases.
   */
  serialize?: (obj: Record<string, unknown>) => string;

  /**
   * Custom comparator function (optional)
   * If provided, this will be used instead of string comparison
   */
  compare?: (a: Record<string, unknown>, b: Record<string, unknown>) => boolean;

  /**
   * Whether to save on initial mount (default: false)
   */
  saveOnInit?: boolean;

  /**
   * Called when a save should be triggered (required)
   */
  onSave: () => void | Promise<void>;

  /**
   * Called just before auto-saving starts
   */
  onBeforeSave?: () => void;

  /**
   * Called after a successful auto-save
   */
  onAfterSave?: () => void;

  /**
   * Called if auto-saving throws or fails
   */
  onError?: (err: unknown) => void;
}

const defaultInertiaFields = [
  'save',
  'applicationId',
  'isDirty',
  'processing',
  'errors',
  'hasErrors',
  'recentlySuccessful',
  'wasSuccessful',
  'data',
  'transform',
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'cancel',
  'reset',
  'clearErrors',
  'setError',
  'setData',
];

/**
 * Automatically watches a Vue 3 form object and triggers save on change with debounce.
 * Includes support for skipping specific fields and Inertia form helpers.
 *
 * @param form - The form object to watch (typically a reactive or ref object)
 * @param options - Configuration for debounce, lifecycle hooks, and field skipping
 * @returns An object with `isAutoSaving` and `blockWatcher()` for temporary disable
 */
export function useAutoSaveForm(
  form: Record<string, unknown> | Ref<Record<string, unknown>>,
  options: UseAutoSaveFormOptions
) {
  const {
    debounce = 3000,
    skipFields = [],
    skipInertiaFields = true,
    deep = true,
    debug = false,
    serialize = JSON.stringify,
    compare,
    saveOnInit = false,
    onSave,
    onBeforeSave,
    onAfterSave,
    onError,
  } = options;

  /**
   * Indicates whether an auto-save is currently in progress
   */
  const isAutoSaving = ref(false);

  /**
   * Controls whether changes should trigger auto-save
   */
  const shouldWatch = ref(true);

  let cancelDebounce: () => void = () => {};
  let cancelTempDebounce: () => void = () => {};

  /**
   * Temporarily blocks the watcher from triggering auto-save.
   * @param ms - Duration in milliseconds to block (default: 1000ms)
   */
  const blockWatcher = (ms = 1000) => {
    shouldWatch.value = false;
    cancelDebounce();
    cancelTempDebounce();
    setTimeout(() => {
      shouldWatch.value = true;
    }, ms);
  };

  /**
   * Unblock auto-saving and perform save with optional custom delay
   * @param ms - Custom delay in milliseconds (null = save immediately, default = null)
   */
  const unblockWatcher = (ms: number | null = null) => {
    shouldWatch.value = true;
    cancelDebounce();
    cancelTempDebounce();

    if (ms === null) {
      save();
    } else {
      const tempDebounced = debounceFn(save, ms);
      cancelTempDebounce = tempDebounced.cancel;
      tempDebounced.call();
    }
  };

  /**
   * Returns a filtered form object excluding skipped fields and Inertia helpers.
   */
  const getWatchedForm = (): Record<string, unknown> => {
    const src: Record<string, unknown> = isRef(form) ? unref(form) as Record<string, unknown> : form;
    const data: Record<string, unknown> = {};
    for (const key of Object.keys(src)) {
      if (skipInertiaFields && defaultInertiaFields.includes(key)) continue;
      if (skipFields.includes(key)) continue;
      data[key] = src[key];
    }
    return data;
  };

  let previousSerialized: string | null = saveOnInit ? null : serialize(getWatchedForm());
  let previousObj: Record<string, unknown> | null = compare
    ? (saveOnInit ? null : getWatchedForm())
    : null;

  /**
   * Internal function that performs the actual save if values changed
   */
  const save = () => {
    if (!shouldWatch.value) return;

    const current = getWatchedForm();

    if (compare) {
      if (previousObj && compare(previousObj, current)) return;
      previousObj = current;
    } else {
      const currentSerialized = serialize(current);
      if (previousSerialized !== null && currentSerialized === previousSerialized) return;
      previousSerialized = currentSerialized;
    }

    if (debug) console.log('[AutoSave] Detected changes. Saving...');
    isAutoSaving.value = true;

    try {
      onBeforeSave?.();

      Promise.resolve(onSave())
        .then(() => {
          onAfterSave?.();
          if (debug) console.log('[AutoSave] Save successful.');
        })
        .catch((err) => {
          onError?.(err);
          if (debug) console.error('[AutoSave] Save failed:', err);
        })
        .finally(() => {
          isAutoSaving.value = false;
        });
    } catch (err) {
      onError?.(err);
      if (debug) console.error('[AutoSave] Immediate error:', err);
      isAutoSaving.value = false;
    }
  };

  /**
   * Debounced save logic using save
   */
  const debounced = debounceFn(save, debounce);
  const debouncedSave = debounced.call;
  cancelDebounce = debounced.cancel;

  const stop = watch(
    () => getWatchedForm(),
    debouncedSave,
    {
      deep,
      flush: 'post',
    }
  );

  onScopeDispose(() => {
    stop();
    cancelDebounce();
    cancelTempDebounce();
  });

  if (saveOnInit) {
    save();
  }

  return {
    isAutoSaving,
    blockWatcher,
    unblockWatcher,
    stop,
  };
}

/**
 * Creates a debounced function with a cancel method
 */
function debounceFn(fn: () => void, delay: number) {
  let timer: ReturnType<typeof setTimeout>;

  return {
    call: () => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(), delay);
    },
    cancel: () => {
      clearTimeout(timer);
    },
  };
}
