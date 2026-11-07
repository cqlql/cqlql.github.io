import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Alert, Button, Checkbox, Input, Modal, Segmented, Select, Tag, Typography } from 'antd'

import { configApi } from '../api.ts'
import type {
  BackupComponent,
  CompareField,
  CompareView,
  ConfigView,
  EnvField,
  SudoMode,
} from '../types.ts'
import {
  changedFields,
  compareTag,
  confirmHint,
  confirmTitle,
  diffCount,
  envInitial,
  envInputPlaceholder,
  envPlaceholder,
  envSavePayload,
  fillableDefaults,
  newServerInitial,
  serverInitial,
  setServerFieldValue,
  splitCompare,
} from '../utils/draft.ts'
import type { CompareTone, ConfirmKind } from '../utils/draft.ts'

/**
 * 页面只做取数、拼装与二次确认；「哪些字段真的改了」在 utils/draft.ts。
 *
 * 🔴 两个视图共用**一次**只读抓取：
 *   - 「编辑本机配置」（默认）：每个输入框下方就地显示远端值 + 状态；
 *   - 「对比远端配置」（次入口）：完整表格，含「仅远端有」的键（表单里没有输入框）。
 * 保存只写本机文件，**不会碰远端**；远端 backup.env 必须再点「同步到远端」。
 *
 * 🔴 配置不全时这页必须能打开：它是把第一台服务器写进 servers.json 的地方。
 * 空清单自动切到「新增」模式，不必再去编辑器手敲 JSON；两种模式共用同一套
 * 字段白名单与 confirm=yes 二次确认（服务端 addServersFile 还会全量校验）。
 */
interface ConfigPageProps {
  /** 保存了 servers.json 时通知 App，让一直挂载着的服务器管理页重新取数。 */
  onServersChanged: () => void
  /** 从「备份监控」的报错引导跳来时 +1：滚到服务器清单区（含只读账号）。 */
  focusServersToken: number
}

export function ConfigPage({ onServersChanged, focusServersToken }: ConfigPageProps) {
  const [data, setData] = useState<ConfigView | null>(null)
  const [serverName, setServerName] = useState('')
  const [serverDraft, setServerDraft] = useState<Record<string, string>>({})
  const [serverBase, setServerBase] = useState<Record<string, string>>({})
  const [envComponent, setEnvComponent] = useState<BackupComponent>('pg')
  const [envDraft, setEnvDraft] = useState<Record<string, string>>({})
  const [envBase, setEnvBase] = useState<Record<string, string>>({})
  // 显式勾了「清空」的键：凭证不回显，只靠输入框留空是清不掉已配好的值的。
  const [envClear, setEnvClear] = useState<string[]>([])
  const [pane, setPane] = useState<'edit' | 'compare'>('edit')
  const [compare, setCompare] = useState<CompareView | null>(null)
  const [compareLoading, setCompareLoading] = useState(false)
  const [compareError, setCompareError] = useState('')
  const [notice, setNotice] = useState<{ kind: 'success' | 'error' | 'info' | 'warning'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<ConfirmKind | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [envDirty, setEnvDirty] = useState(false)
  const [syncLog, setSyncLog] = useState('')
  // 新增模式：空清单（换电脑第一次用）直接进这一态，别让人对着灰掉的保存按钮发呆。
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')

  const load = useCallback(async () => {
    try {
      const v = await configApi.view()
      setData(v)
      setServerName((prev) => prev || v.servers[0]?.name || '')
      if (v.servers.length === 0) setAdding(true)
    } catch (e) {
      setNotice({ kind: 'error', text: errText(e) })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // 页面一直挂载、切回来不重新取数，滚动位置同样保留；所以从监控页的引导跳来时
  // 要显式定位，否则人可能还停在上次看 MinIO env 的中段，看不到只读账号区块。
  const serversRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (focusServersToken > 0) {
      serversRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }
  }, [focusServersToken])

  const currentServer = adding ? undefined : data?.servers.find((s) => s.name === serverName)
  const currentEnv = data?.envs.find((e) => e.component === envComponent)

  useEffect(() => {
    if (adding) {
      // base 为空 => changedFields 会把所有非空字段（含默认 role/port/sudo_mode）
      // 一起提交，服务端再按同一套规则全量校验。
      setServerBase({})
      setServerDraft(newServerInitial())
      return
    }
    if (!currentServer) return
    const base = serverInitial(currentServer)
    setServerBase(base)
    setServerDraft(base)
  }, [adding, currentServer])

  useEffect(() => {
    if (!currentEnv) return
    const base = envInitial(currentEnv.fields)
    setEnvBase(base)
    setEnvDraft(base)
    setEnvClear([])
  }, [currentEnv])

  // 远端值：进入页面 / 切服务器 / 切组件时各抓一次；失败只留一条集中提示。
  const fetchCompare = useCallback(async () => {
    if (!serverName) return
    setCompareLoading(true)
    setCompareError('')
    try {
      const r = await configApi.compare(serverName, envComponent)
      setCompare(r)
      if (r.error) setCompareError(r.error)
    } catch (e) {
      setCompareError(errText(e))
    } finally {
      setCompareLoading(false)
    }
  }, [serverName, envComponent])

  useEffect(() => {
    void fetchCompare()
  }, [fetchCompare])

  const groups = useMemo(() => groupEnvFields(currentEnv?.fields ?? []), [currentEnv])

  // 「填入推荐默认值」只改表单：仍需保存 + yes 确认才落盘，不碰远端。
  const defaultsFill = useMemo(
    () => (currentEnv ? fillableDefaults(currentEnv.fields, envDraft) : null),
    [currentEnv, envDraft],
  )

  const currentCompare = compare?.components.find((c) => c.component === envComponent)
  const compareFields = useMemo(() => currentCompare?.fields ?? [], [currentCompare])
  const { form: compareForm, extra: compareExtra } = useMemo(
    () => splitCompare(compareFields),
    [compareFields],
  )
  const compareByKey = useMemo(
    () => new Map(compareForm.map((f) => [f.key, f])),
    [compareForm],
  )
  const compareGroups = useMemo(() => groupCompareFields(compareFields), [compareFields])

  const pendingCount = useMemo(() => {
    if (pending === 'servers') return Object.keys(changedFields(serverBase, serverDraft)).length
    if (pending === 'add') {
      return Object.keys(changedFields(serverBase, serverDraft)).length + (newName.trim() ? 1 : 0)
    }
    if (pending === 'env') {
      const p = envSavePayload(envBase, envDraft, envClear)
      return Object.keys(p.fields).length + p.clear.length
    }
    return 0
  }, [pending, serverBase, serverDraft, envBase, envDraft, envClear, newName])

  const setServerField = (key: string, value: string) =>
    setServerDraft((prev) => setServerFieldValue(prev, key, value))
  const setEnvField = (key: string, value: string) => {
    setEnvDraft((prev) => ({ ...prev, [key]: value }))
    // 填了新值就自动撤销该键的「清空」，两个动作不并存。
    if (value !== '') setEnvClear((prev) => prev.filter((k) => k !== key))
  }
  const toggleEnvClear = (key: string) => {
    const on = !envClear.includes(key)
    setEnvClear(on ? [...envClear, key] : envClear.filter((k) => k !== key))
    if (on) setEnvDraft((prev) => ({ ...prev, [key]: '' }))
  }

  const askConfirm = (kind: ConfirmKind) => {
    setPending(kind)
    setConfirmText('')
  }
  const closeConfirm = () => {
    setPending(null)
    setConfirmText('')
  }

  const submitConfirm = async () => {
    if (confirmText !== 'yes' || !pending) return
    const kind = pending
    closeConfirm()
    setBusy(true)
    try {
      if (kind === 'add') {
        const fields = { ...changedFields(serverBase, serverDraft), name: newName.trim() }
        const r = await configApi.addServer(fields)
        setNotice({
          kind: 'success',
          text: `已新增服务器（${r.changed.length} 项配置，0600 并留 .bak）。服务器管理页会自动刷新；这一步只写本机，没有连任何远端。`,
        })
        setAdding(false)
        setNewName('')
        onServersChanged()
        await load()
        void fetchCompare()
      } else if (kind === 'servers') {
        const fields = changedFields(serverBase, serverDraft)
        if (!Object.keys(fields).length) {
          setNotice({ kind: 'info', text: '没有需要保存的修改。' })
          return
        }
        const r = await configApi.saveServers(serverName, fields)
        setNotice({
          kind: 'success',
          text: `已保存 ${r.changed.length} 项。` +
            (r.needs_sudo_reapply
              ? '登录账号或 sudo 模式变了，请到服务器管理页重新执行「一键免密 sudo」。'
              : ''),
        })
        onServersChanged()
        await load()
        void fetchCompare()
      } else if (kind === 'env') {
        const payload = envSavePayload(envBase, envDraft, envClear)
        if (!Object.keys(payload.fields).length && !payload.clear.length) {
          setNotice({ kind: 'info', text: '没有需要保存的修改。' })
          return
        }
        const r = await configApi.saveEnv(envComponent, payload.fields, payload.clear)
        setEnvClear([])
        setEnvDirty(true)
        setNotice({
          kind: 'success',
          text: `已保存本机 ${r.changed.length} 项` +
            (payload.clear.length ? `（含 ${payload.clear.length} 项清空）` : '') +
            '（0600，已留 .bak）。远端 backup.env 未同步，请点「同步到远端」。',
        })
        await load()
        void fetchCompare()
      } else {
        const r = await configApi.syncEnv(serverName, envComponent)
        setSyncLog(r.log)
        if (r.synced) {
          setEnvDirty(false)
          setNotice({ kind: 'success', text: `已同步到 ${serverName} 的 ${envComponent}/backup.env。` })
          void fetchCompare()
        } else {
          setNotice({ kind: 'error', text: `同步失败（退出码 ${r.exit_code}），请看下方输出。` })
        }
      }
    } catch (e) {
      setNotice({ kind: 'error', text: errText(e) })
    } finally {
      setBusy(false)
    }
  }

  const envDiff = diffCount(compareFields)
  const remoteStatus = compareLoading ? (
    <span>正在读取远端 backup.env（只读）…</span>
  ) : compareError ? (
    <span className="err" title={compareError}>远端值暂不可用：{compareError}（本机配置仍可编辑）</span>
  ) : compare?.fetched_at ? (
    <span>远端值读取于 {compare.fetched_at} · 只读抓取，不写远端</span>
  ) : (
    <span>尚未读取远端值</span>
  )

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>配置</h1>
          <div className="page-meta">服务器清单与备份配置；保存只写本机，远端要显式同步</div>
        </div>
        <Tag>本机文件 · 0600</Tag>
      </header>

      {notice && (
        <Alert
          style={{ marginBottom: 12 }}
          type={notice.kind}
          showIcon
          closable
          message={notice.text}
          onClose={() => setNotice(null)}
        />
      )}

      {data?.setup_error && (
        <Alert
          style={{ marginBottom: 12 }}
          type="warning"
          showIcon
          message="配置还没齐全"
          description={`${data.setup_error}。可以直接在下面新增一台服务器；保存只写本机文件，不会连任何远端。`}
        />
      )}

      <Alert
        style={{ marginBottom: 12 }}
        type="info"
        showIcon
        message="两份配置、两条链路"
        description="servers.json 决定本机怎么登录备份端；backup/*.env 决定备份脚本每天怎么连主服务器拉 dump。两者互不相干，别拿登录账号去解释备份日志里的用户。"
      />

      <div className="card config-panel" ref={serversRef}>
        <h3>服务器清单{adding ? ' · 新增一台' : ''}</h3>
        {adding && (
          <Alert
            style={{ marginBottom: 12 }}
            type="info"
            showIcon
            message="填名称、主机、登录账号即可"
            description="端口 / 角色 / sudo 模式已给默认值。保存会先把整份清单做一次全量校验，校验不通过原文件一字不动；这一步只写本机，不连远端。"
          />
        )}
        <div className="config-grid">
          <label className="config-field">
            <span>{adding ? '名称（name）' : '服务器'}</span>
            {adding ? (
              <Input
                value={newName}
                placeholder="例如 backup-1（字母数字与 . _ -）"
                onChange={(e) => setNewName(e.target.value)}
              />
            ) : (
              <Select
                value={serverName || undefined}
                placeholder="从 servers.json 选择"
                options={(data?.servers ?? []).map((s) => ({ label: `${s.name}（${s.role}）`, value: s.name }))}
                onChange={(v: string) => setServerName(v)}
              />
            )}
          </label>
          <label className="config-field">
            <span>主机</span>
            <Input value={serverDraft.host ?? ''} onChange={(e) => setServerField('host', e.target.value)} />
          </label>
          <label className="config-field">
            <span>端口</span>
            <Input value={serverDraft.port ?? ''} onChange={(e) => setServerField('port', e.target.value)} />
          </label>
          <label className="config-field">
            <span>登录账号</span>
            <Input value={serverDraft.user ?? ''} onChange={(e) => setServerField('user', e.target.value)} />
          </label>
          <label className="config-field">
            <span>角色</span>
            <Select
              value={serverDraft.role}
              options={['backup', 'app', 'db', 'other'].map((v) => ({ label: v, value: v }))}
              onChange={(v: string) => setServerField('role', v)}
            />
          </label>
          <label className="config-field">
            <span>sudo 模式</span>
            <Select
              value={(serverDraft.sudo_mode ?? 'nopasswd') as SudoMode}
              options={[
                { label: 'nopasswd（免密 sudo）', value: 'nopasswd' },
                { label: 'root（直接 root 登录）', value: 'root' },
                { label: 'none（不提权，安装会失败）', value: 'none' },
              ]}
              onChange={(v: SudoMode) => setServerField('sudo_mode', v)}
            />
          </label>
          <label className="config-field">
            <span>备注</span>
            <Input value={serverDraft.note ?? ''} onChange={(e) => setServerField('note', e.target.value)} />
          </label>
          <label className="config-field">
            <span>私钥路径</span>
            <Input.Password
              value={serverDraft.key ?? ''}
              autoComplete="off"
              placeholder={currentServer?.has_key ? '已配置，留空保持不变' : '未配置'}
              onChange={(e) => setServerField('key', e.target.value)}
            />
          </label>
          <label className="config-field">
            <span>sudo 密码</span>
            <Input.Password
              value={serverDraft.sudo_password ?? ''}
              autoComplete="off"
              placeholder={currentServer?.password_configured ? '已配置，留空保持不变' : '未配置，可留空'}
              onChange={(e) => setServerField('sudo_password', e.target.value)}
            />
          </label>
        </div>

        {/* P2+：备份监控页报「缺只读账号」时，来这里补。与上面的登录账号是两个身份。 */}
        <div className="config-monitor">
          <div className="config-monitor-head">
            <strong>只读监控账号</strong>
            <Tag color={adding ? 'blue' : currentServer?.monitor_configured ? 'green' : 'orange'}>
              {adding ? '新增时填写' : currentServer?.monitor_configured ? '已配置' : '未配置（备份监控页不可用）'}
            </Tag>
            <span>仅用于只读采集备份状态，与上面的登录账号必须是两个人</span>
          </div>
          <div className="config-grid">
            <label className="config-field">
              <span>只读账号用户名</span>
              <Input
                value={serverDraft.monitor_user ?? ''}
                disabled={serverDraft.monitor_clear === 'yes'}
                placeholder="例如 passup-ro（不能等于登录账号，不能是 root）"
                onChange={(e) => setServerField('monitor_user', e.target.value)}
              />
            </label>
            <label className="config-field">
              <span>只读账号私钥路径</span>
              <Input.Password
                value={serverDraft.monitor_key ?? ''}
                autoComplete="off"
                disabled={serverDraft.monitor_clear === 'yes'}
                placeholder={currentServer?.monitor_key_configured
                  ? '已配置，留空保持不变'
                  : '本机私钥绝对路径，例如 C:/Users/<你>/.ssh/id_ed25519_ro'}
                onChange={(e) => setServerField('monitor_key', e.target.value)}
              />
            </label>
          </div>
          <div className="config-monitor-foot">
            <Checkbox
              checked={serverDraft.monitor_clear === 'yes'}
              disabled={busy}
              onChange={(e) => setServerField('monitor_clear', e.target.checked ? 'yes' : '')}
            >
              移除这个只读账号（显式勾选才会删除）
            </Checkbox>
            <span>
              私钥路径不回显；保存前会校验账号不撞车、不是 root、私钥文件存在。
              只写本机 servers.json，保存后回「备份监控」页点「立即刷新」。
            </span>
          </div>
        </div>

        <div className="config-chain">
          <span>执行方式（只读推导，不是可配项）</span>
          <code>{currentServer?.exec_chain ?? '—'}</code>
        </div>

        <div className="config-actions">
          <Button
            type="primary"
            loading={busy}
            disabled={adding ? !newName.trim() : !currentServer}
            onClick={() => askConfirm(adding ? 'add' : 'servers')}
          >
            {adding ? '新增这台服务器' : '保存服务器清单'}
          </Button>
          <Button
            disabled={busy || (adding && (data?.servers.length ?? 0) === 0)}
            onClick={() => {
              setAdding((v) => !v)
              setNewName('')
            }}
          >
            {adding ? '改为编辑已有服务器' : '新增服务器'}
          </Button>
          <Typography.Text type="secondary" style={{ fontSize: 12, flexBasis: '100%' }}>
            {adding
              ? '名称是主键，新增后不能改；主机与登录账号按 docs/servers.md §3 填写。'
              : '改了登录账号 / sudo 模式后，免密 sudo 的 drop-in 是按用户名写的，需重新配置。'}
          </Typography.Text>
        </div>
      </div>

      <div className="card config-panel">
        <h3>备份配置</h3>
        <div className="config-actions">
          <Segmented
            options={[
              { label: '编辑本机配置', value: 'edit' },
              { label: '对比远端配置', value: 'compare' },
            ]}
            value={pane}
            onChange={(v) => setPane(String(v) as 'edit' | 'compare')}
          />
          <Segmented
            options={[
              { label: 'PostgreSQL', value: 'pg' },
              { label: 'MinIO', value: 'minio' },
            ]}
            value={envComponent}
            onChange={(v) => setEnvComponent(String(v) as BackupComponent)}
          />
          <span className="config-path">{currentEnv?.path ?? '—'}</span>
          {!currentEnv?.exists && <Tag color="warning">本机文件不存在，保存时会创建</Tag>}
        </div>

        <div className="config-remote-status">
          {remoteStatus}
          <Button size="small" loading={compareLoading} onClick={() => void fetchCompare()}>
            重新读取
          </Button>
        </div>

        {pane === 'edit' ? (
          <>
            {groups.map(([group, fields]) => (
              <div className="config-group" key={group}>
                <h4>{group}</h4>
                <div className="config-grid">
                  {fields.map((f) => {
                    const cf = compareByKey.get(f.key)
                    const marked = envClear.includes(f.key)
                    const inputId = `env-${envComponent}-${f.key}`
                    const inputProps = {
                      id: inputId,
                      value: envDraft[f.key] ?? '',
                      disabled: marked,
                      placeholder: marked
                        ? '保存后将清空此项'
                        : f.secret ? envPlaceholder(f) : envInputPlaceholder(f),
                      onChange: (e: ChangeEvent<HTMLInputElement>) => setEnvField(f.key, e.target.value),
                    }
                    return (
                      <div className="config-field" key={f.key}>
                        <span title={f.key}>
                          <span className="config-field-title">
                            <label htmlFor={inputId}>{f.label}</label>
                            <small>{f.key}</small>
                          </span>
                          {f.configured && (
                            <Button
                              type="link"
                              size="small"
                              className="config-clear"
                              danger={marked}
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                toggleEnvClear(f.key)
                              }}
                            >
                              {marked ? '撤销清空' : '清空'}
                            </Button>
                          )}
                        </span>
                        {f.secret ? (
                          <Input.Password {...inputProps} autoComplete="off" />
                        ) : (
                          <Input {...inputProps} />
                        )}
                        {cf && <RemoteLine field={cf} />}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {compareExtra.length > 0 && (
              <details className="config-extra">
                <summary>远端还有 {compareExtra.length} 项本机没有（表单里没有对应输入框）</summary>
                <p className="config-warn">
                  同步是整份覆盖：这些项会随同步从远端消失。要保留就先把它们加到本机配置。
                </p>
                <ul>
                  {compareExtra.map((f) => (
                    <li key={f.key}>
                      <code>{f.key}</code> = {f.remote ? <code>{f.remote}</code> : '未配置'}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <div className="config-actions">
              <Button
                disabled={busy || !currentEnv || !defaultsFill}
                title="把有默认值的非凭证项填进表单；仍要保存本机配置并同步到远端，预检才会通过"
                onClick={() => {
                  if (defaultsFill) setEnvDraft(defaultsFill)
                }}
              >
                填入推荐默认值
              </Button>
              <Button type="primary" loading={busy} disabled={!currentEnv} onClick={() => askConfirm('env')}>
                保存本机配置
              </Button>
              <Button
                danger
                loading={busy}
                disabled={!currentEnv || !data?.sync_enabled || !serverName || envDiff === 0}
                onClick={() => askConfirm('sync')}
              >
                同步到远端{envDiff > 0 ? `（${envDiff} 项）` : ''}
              </Button>
              {envDirty ? (
                <Tag color="warning">本机已改 · 远端 backup.env 未同步</Tag>
              ) : (
                <Tag>保存后请显式同步，远端才会生效</Tag>
              )}
            </div>
            <Alert
              type="warning"
              showIcon
              style={{ marginTop: 12 }}
              message="留空 ≠ 生效：默认值只在备份脚本运行时兜底"
              description={
                <>
                  默认值不会写进本机或远端 <code>backup.env</code>；预检 / 安装按「文件里有没有这一行」判定，
                  被列为必填的键（如 <code>PG_BACKUP_ROOT</code>）留空会报「未配置」并让安装失败。
                  要过自检：点「填入推荐默认值」→「保存本机配置」(yes) →「同步到远端」(yes)。
                  主机、私钥、密钥等没有默认值，必须自己填。
                </>
              }
            />
          </>
        ) : (
          <>
            {compareError ? (
              <Alert
                style={{ marginTop: 12 }}
                type="error"
                showIcon
                message="读取远端配置失败"
                description={compareError}
              />
            ) : compareFields.length === 0 ? (
              <Alert style={{ marginTop: 12 }} type="info" showIcon message="还没有对比结果，点「重新读取」。" />
            ) : (
              <div className="config-compare-wrap">
                <table className="config-compare-table">
                  <thead>
                    <tr>
                      <th>配置项</th>
                      <th>远端现值</th>
                      <th>本机值</th>
                      <th>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compareGroups.map(([group, fields]) => (
                      <Fragment key={group}>
                        <tr className="group">
                          <td colSpan={4}>{group}</td>
                        </tr>
                        {fields.map((f) => (
                          <tr key={f.key} className={f.state === 'changed' ? 'changed-row' : ''}>
                            <td>
                              <span className="field-name">{f.label}</span>
                              <span className="field-key">{f.key}</span>
                            </td>
                            <td>{f.remote ? <code>{f.remote}</code> : <span className="empty">—</span>}</td>
                            <td>{f.local ? <code>{f.local}</code> : <span className="empty">—</span>}</td>
                            <td>
                              <Tag color={toneColor(compareTag(f.state).tone)}>
                                {compareTag(f.state).text}
                              </Tag>
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="config-actions">
              <Button
                danger
                loading={busy}
                disabled={!currentEnv || !data?.sync_enabled || !serverName || envDiff === 0}
                onClick={() => askConfirm('sync')}
              >
                同步到远端{envDiff > 0 ? `（${envDiff} 项）` : ''}
              </Button>
              <Tag>同步是整份覆盖：远端独有项会消失</Tag>
            </div>
          </>
        )}

        {syncLog && <pre className="backup-log">{syncLog}</pre>}

        <Typography.Paragraph type="secondary" style={{ marginTop: 12, fontSize: 12 }}>
          凭证字段只显示「已配置」，留空表示保持不变；填写新值即覆盖。要清掉已配置的值，点字段右侧的
          「清空」再保存（写成空值，仍需输入 yes），仅把输入框删空不会清空。保存会先留 <code>.bak</code>，
          值按 shell 字面量转义。同步只更新远端 <code>backup.env</code>，不重跑安装脚本、不动 crontab。
        </Typography.Paragraph>
      </div>

      <Modal
        open={pending !== null}
        title={confirmTitle(pending ?? 'servers')}
        okText="确认"
        cancelText="取消"
        okButtonProps={{ danger: pending === 'sync', disabled: confirmText !== 'yes' }}
        onOk={() => void submitConfirm()}
        onCancel={closeConfirm}
        afterClose={() => setConfirmText('')}
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="这是写操作"
          description={confirmHint(pending ?? 'servers', {
            server: serverName,
            component: envComponent,
            count: pendingCount,
            clearCount: pending === 'env' ? envSavePayload(envBase, envDraft, envClear).clear.length : 0,
          })}
        />
        <p className="hint">请输入 <code>yes</code> 确认：</p>
        <Input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          onPressEnter={() => void submitConfirm()}
          autoFocus
          autoComplete="off"
          placeholder="yes"
        />
      </Modal>
    </div>
  )
}

function RemoteLine({ field }: { field: CompareField }) {
  const tag = compareTag(field.state)
  return (
    <span className="config-remote">
      <span>远端：</span>
      {field.remote ? <code>{field.remote}</code> : <span className="empty">未配置</span>}
      <Tag color={toneColor(tag.tone)}>{tag.text}</Tag>
    </span>
  )
}

function toneColor(tone: CompareTone): string | undefined {
  switch (tone) {
    case 'warning':
      return 'warning'
    case 'info':
      return 'processing'
    case 'success':
      return 'success'
    default:
      return undefined
  }
}

function groupEnvFields(fields: EnvField[]): [string, EnvField[]][] {
  const m = new Map<string, EnvField[]>()
  for (const f of fields) {
    const list = m.get(f.group) ?? []
    list.push(f)
    m.set(f.group, list)
  }
  return [...m.entries()]
}

function groupCompareFields(fields: CompareField[]): [string, CompareField[]][] {
  const m = new Map<string, CompareField[]>()
  for (const f of fields) {
    const list = m.get(f.group) ?? []
    list.push(f)
    m.set(f.group, list)
  }
  return [...m.entries()]
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
