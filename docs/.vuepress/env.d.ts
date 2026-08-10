/// <reference types="vite/client" />

declare module '@iconify/vue' {
  import type { DefineSetupFnComponent } from 'vue'

  export interface IconProps {
    icon: string
    width?: string | number
    height?: string | number
    inline?: boolean
    hFlip?: boolean
    vFlip?: boolean
    flip?: string
    rotate?: number | string
    color?: string
    horizontalFlip?: boolean
    verticalFlip?: boolean
    hAlign?: boolean
    vAlign?: boolean
    slice?: boolean
    onLoad?: (event: CustomEvent) => void
  }

  export const Icon: DefineSetupFnComponent<IconProps>
}
