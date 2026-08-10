import { reactive, inject, provide, type InjectionKey } from 'vue'

export interface CollapseState {
  /** 记录被用户手动折叠的节点 key */
  collapsed: Record<string, boolean>
  /** 切换折叠状态 */
  toggle: (key: string, currentExpanded: boolean) => void
  /** 查询是否展开 */
  isExpanded: (key: string, defaultExpanded: boolean) => boolean
}

const COLLAPSE_KEY: InjectionKey<CollapseState> = Symbol('collapse')

/**
 * 在根组件中 provide 折叠状态
 */
export function provideCollapse(): CollapseState {
  const collapsed = reactive<Record<string, boolean>>({})

  const state: CollapseState = {
    collapsed,
    toggle(key: string, currentExpanded: boolean) {
      if (key in collapsed) {
        collapsed[key] = !collapsed[key]
      } else {
        collapsed[key] = currentExpanded
      }
    },
    isExpanded(key: string, defaultExpanded: boolean) {
      if (key in collapsed) return !collapsed[key]
      return defaultExpanded
    },
  }

  provide(COLLAPSE_KEY, state)
  return state
}

/**
 * 在子组件中 inject 折叠状态
 */
export function useCollapse(): CollapseState {
  const state = inject(COLLAPSE_KEY)
  if (!state) {
    throw new Error('useCollapse() must be used inside a component tree with provideCollapse()')
  }
  return state
}
