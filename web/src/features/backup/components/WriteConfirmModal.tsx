import type { ReactNode } from 'react'
import { Alert, Input, Modal } from 'antd'

/**
 * 备份域写动作共用的二次确认弹窗：「备份能力部署」的安装 / 装依赖 / 卸依赖，
 * 与「手动备份」的立即执行都走这一个组件（docs/backup-once.md §7 第 4 条）。
 *
 * 🔴 `showPassword` 默认 false：手动备份以清单 user 跑、root=false 不提权，
 *    弹窗里根本没有 sudo 密码输入框（分册 §3 门④ / 原型 §2.4 O4）。
 *    只有安装期才由调用方显式打开；密码不在组件里缓存，全部受控传入。
 * 🔴 组件只管展示，校验（yes / 勾选项 / 白名单）由页面与 Go 侧各自再验一次。
 */
export interface WriteConfirmModalProps {
  open: boolean
  title: string
  okText?: string
  alertMessage?: string
  alertDescription: ReactNode
  /** 模式专属区块：依赖清单 / 卸载勾选 / 影响清单等。 */
  children?: ReactNode
  yes: string
  onYes: (value: string) => void
  /** 由页面按门禁算好；组件不自己判「能不能点」。 */
  okDisabled?: boolean
  onSubmit: () => void
  onCancel: () => void
  onAfterClose?: () => void
  showPassword?: boolean
  password?: string
  onPassword?: (value: string) => void
  /** 弹窗底部注记：预演不是执行凭证 / 手动触发不代表定时任务正常。 */
  footerNote?: ReactNode
}

export function WriteConfirmModal({
  open,
  title,
  okText = '确认',
  alertMessage = '这是写操作',
  alertDescription,
  children,
  yes,
  onYes,
  okDisabled = false,
  onSubmit,
  onCancel,
  onAfterClose,
  showPassword = false,
  password = '',
  onPassword,
  footerNote,
}: WriteConfirmModalProps) {
  return (
    <Modal
      open={open}
      title={title}
      okText={okText}
      cancelText="取消"
      okButtonProps={{ danger: true, disabled: okDisabled }}
      onOk={onSubmit}
      onCancel={onCancel}
      afterClose={onAfterClose}
    >
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12 }}
        message={alertMessage}
        description={alertDescription}
      />
      {children}
      <p className="hint">请输入 <code>yes</code> 确认（与命令行菜单一致，服务端还会再验一次）：</p>
      <Input
        value={yes}
        onChange={(e) => onYes(e.target.value)}
        onPressEnter={onSubmit}
        autoFocus
        autoComplete="off"
        placeholder="yes"
      />
      {showPassword && (
        <>
          <p className="hint" style={{ marginTop: 12 }}>
            初始 sudo 密码（清单已配 <code>sudo.password</code> 或已免密时留空）：
            只用于本次请求，不落盘、不写日志。
          </p>
          <Input.Password
            value={password}
            onChange={(e) => onPassword?.(e.target.value)}
            autoComplete="off"
            placeholder="可留空"
          />
        </>
      )}
      {footerNote && <p className="hint" style={{ marginTop: 12 }}>{footerNote}</p>}
    </Modal>
  )
}
