// tasksService — Google Tasks「読む」サービス(S2-4①)
//
// 役割: GoogleAuthProvider.getAccessToken() で取得したトークンで Google Tasks API を叩き、
//       未完了タスクを構造化して返す。function calling の getTasks ツールの実体。
//
// 範囲(S2-4①): 読み取り(read)のみ。追加・編集・削除は実装しない(後続指示)。
//
// 構造化: notes 内の [予定時刻:HH:MM] / [期限:YYYY-MM-DD] を parseTaskNotes で分離し、
//         { title, due, time, notes } の形にする(読み書き共用ヘルパ taskNotes を使用)。

import type { AuthProvider } from '@/interfaces/AuthProvider'
import type { Clock, Logger } from '@/interfaces/types'
import { parseTaskNotes } from './taskNotes'

/** 取得スコープ。today=期限が今日のもの / all=未完了すべて。 */
export type TasksScope = 'today' | 'all'

/** 構造化済みタスク(画面表示・モデル提示の両方に使う最小形)。 */
export interface StructuredTask {
  id: string
  title: string
  /** 期限日(YYYY-MM-DD)。notes の [期限:] を優先、無ければ API の due 日付。 */
  due?: string
  /** 予定時刻(HH:MM)。notes の [予定時刻:] 由来。 */
  time?: string
  /** ブラケット記法を除いた本文。 */
  notes: string
}

export type GetTasksResult =
  | { ok: true; scope: TasksScope; tasks: StructuredTask[]; remaining: number }
  | { ok: false; reason: GetTasksErrorReason }

/**
 * 失敗理由。auth 系(未ログイン / 再ログイン要)を getAccessToken の reason から引き継ぐ。
 * 'unknown' を含め「未来縛らない」原則を踏襲。
 */
export type GetTasksErrorReason =
  | 'no_refresh_token' // 未ログイン(refresh_token が無い)
  | 'refresh_failed' // refresh_token 失効 → 再ログイン要
  | 'auth' // トークンは取れたが Tasks API が 401/403(スコープ不足等)
  | 'network'
  | 'unknown'

export interface TasksService {
  getTasks(scope: TasksScope): Promise<GetTasksResult>
}

// Tasks API レスポンス(必要分のみ)
interface GoogleTask {
  id?: string
  title?: string
  notes?: string
  status?: string
  due?: string // RFC3339(日付のみ意味あり。例 '2026-06-07T00:00:00.000Z')
}
interface GoogleTasksListResponse {
  items?: GoogleTask[]
}

const TASKS_ENDPOINT =
  'https://tasks.googleapis.com/tasks/v1/lists/@default/tasks'

/**
 * Tasks「読む」サービスを生成する。
 * @param auth getAccessToken() を持つ AuthProvider(本番は GoogleAuthProvider)
 * @param clock 「今日」判定に使う(テスト容易性のため new Date() を直書きしない)
 */
export function createTasksService(
  auth: Pick<AuthProvider, 'getAccessToken'>,
  clock: Clock,
  logger?: Logger,
): TasksService {
  async function getTasks(scope: TasksScope): Promise<GetTasksResult> {
    const tokenResult = await auth.getAccessToken()
    if (!tokenResult.ok) {
      // getAccessToken の reason をそのまま引き継ぐ(no_refresh_token / refresh_failed / network / unknown)
      return { ok: false, reason: tokenResult.reason }
    }

    const url = `${TASKS_ENDPOINT}?showCompleted=false&maxResults=100`
    let res: Response
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${tokenResult.token}` },
      })
    } catch {
      return { ok: false, reason: 'network' }
    }

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return { ok: false, reason: 'auth' }
      }
      logger?.error?.('tasksService.getTasks: Tasks API error', { status: res.status })
      return { ok: false, reason: 'unknown' }
    }

    let json: GoogleTasksListResponse
    try {
      json = (await res.json()) as GoogleTasksListResponse
    } catch {
      return { ok: false, reason: 'unknown' }
    }

    const todayStr = localDateStr(clock.now())
    const all: StructuredTask[] = (json.items ?? [])
      // 未完了のみ(API でも絞っているが念のため)
      .filter((t) => t.status !== 'completed')
      .map((t) => toStructured(t))

    const tasks = scope === 'today' ? all.filter((t) => t.due === todayStr) : all
    return { ok: true, scope, tasks, remaining: tasks.length }
  }

  return { getTasks }
}

/** GoogleTask を構造化形へ。notes のタグを優先し、無ければ API due の日付を採る。 */
function toStructured(t: GoogleTask): StructuredTask {
  const parsed = parseTaskNotes(t.notes)
  const apiDue = t.due ? t.due.slice(0, 10) : undefined // RFC3339 の日付部分
  return {
    id: t.id ?? '',
    title: t.title ?? '(無題)',
    due: parsed.due ?? apiDue,
    time: parsed.time,
    notes: parsed.body,
  }
}

/** Date をローカル日付の YYYY-MM-DD にする。 */
function localDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
