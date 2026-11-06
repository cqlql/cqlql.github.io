import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Input, Modal, Segmented, Select, Tag, Typography } from 'antd'

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
  serverInitial,
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
 */
export function ConfigPage() {
  const [data, setData] = useState<ConfigView | null>(null)
  const [serverName, setServerName] = useState('')
  const [serverDraft, setServerDraft] = useState<Record<string, string>>({})
  const [serverBase, setServerBase] = useState<Record<string, string>>({})
  const [envComponent, setEnvComponent] = useState<BackupComponent>('pg')
  const [envDraft, setEnvDraft] = useState<Record<string, string>>({})
  const [envBase, setEnvBase] = useState<Record<string, string>>({})
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

  const load = useCallback(async () => {
    try {
      const v = await configApi.view()
      setData(v)
      setServerName((prev) => prev || v.servers[0]?.name || '')
    } catch (e) {
      setNotice({ kind: 'error', text: errText(e) })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const currentServer = data?.servers.find((s) => s.name === serverName)
  const currentEnv = data?.envs.find((e) => e.component === envComponent)

  useEffect(() => {
    if (!currentServer) return
    const base = serverInitial(currentServer)
    setServerBase(base)
    setServerDraft(base)
  }, [currentServer])

  useEffect(() => {
    if (!currentEnv) return
    const base = envInitial(currentEnv.fields)
    setEnvBase(base)
    setEnvDraft(base)
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
    if (pending === 'env') return Object.keys(changedFields(envBase, envDraft)).length
    return 0
  }, [pending, serverBase, serverDraft, envBase, envDraft])

  const setServerField = (key: string, value: string) =>
    setServerDraft((prev) => ({ ...prev, [key]: value }))
  const setEnvField = (key: string, value: string) =>
    setEnvDraft((prev) => ({ ...prev, [key]: value }))

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
      if (kind === 'servers') {
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
        await load()
        void fetchCompare()
      } else if (kind === 'env') {
        const fields = changedFields(envBase, envDraft)
        if (!Object.keys(fields).length) {
          setNotice({ kind: 'info', text: '没有需要保存的修改。' })
          return
        }
        const r = await configApi.saveEnv(envComponent, fields)
        setEnvDirty(true)
        setNotice({
          kind: 'success',
          text: `已保存本机 ${r.changed.length} 项（0600，已留 .bak）。远端 backup.env 未同步，请点「同步到远端」。`,
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

      <Alert
        style={{ marginBottom: 12 }}
        type="info"
        showIcon
        message="两份配置、两条链路"
        description="servers.json 决定本机怎么登录备份端；backup/*.env 决定备份脚本每天怎么连主服务器拉 dump。两者互不相干，别拿登录账号去解释备份日志里的用户。"
      />

      <div className="card config-panel">
        <h3>服务器清单</h3>
        <div className="config-grid">
          <label className="config-field">
            <span>服务器</span>
            <Select
              value={serverName || undefined}
              placeholder="从 servers.json 选择"
              options={(data?.servers ?? []).map((s) => ({ label: `${s.name}（${s.role}）`, value: s.name }))}
              onChange={(v: string) => setServerName(v)}
            />
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

        <div className="config-chain">
          <span>执行方式（只读推导，不是可配项）</span>
          <code>{currentServer?.exec_chain ?? '—'}</code>
        </div>

        <div className="config-actions">
          <Button type="primary" loading={busy} disabled={!currentServer} onClick={() => askConfirm('servers')}>
            保存服务器清单
          </Button>
          <Typography.Text type="secondary" style={{ fontSize: 12, flexBasis: '100%' }}>
            改了登录账号 / sudo 模式后，免密 sudo 的 drop-in 是按用户名写的，需重新配置。
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
                    return (
                      <label className="config-field" key={f.key}>
                        <span title={f.key}>
                          {f.label}
                          <small>{f.key}</small>
                        </span>
                        {f.secret ? (
                          <Input.Password
                            value={envDraft[f.key] ?? ''}
                            autoComplete="off"
                            placeholder={envPlaceholder(f)}
                            onChange={(e) => setEnvField(f.key, e.target.value)}
                          />
                        ) : (
                          <Input
                            value={envDraft[f.key] ?? ''}
                            placeholder={envInputPlaceholder(f)}
                            onChange={(e) => setEnvField(f.key, e.target.value)}
                          />
                        )}
                        {cf && <RemoteLine field={cf} />}
                      </label>
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
          凭证字段只显示「已配置」，留空表示保持不变；填写新值即覆盖。保存会先留 <code>.bak</code>，
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
