import { useEffect, useMemo, useRef, useState } from 'react'
import Spline from '@splinetool/react-spline'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

function Hero() {
  return (
    <div className="relative w-full h-[60vh] min-h-[420px] overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <Spline scene="https://prod.spline.design/LU2mWMPbF3Qi1Qxh/scene.splinecode" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/40 to-white/95" />
      <div className="relative h-full flex flex-col items-center justify-center px-4 text-center">
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-gray-900 drop-shadow-sm">
          Potongin.com
        </h1>
        <p className="mt-3 text-base sm:text-lg text-gray-700 max-w-2xl">
          One link, one clip — effortless video trimming. Paste a YouTube URL,
          highlight text to clip, and share instantly.
        </p>
      </div>
    </div>
  )
}

function YouTubeEmbed({ videoId, start=0 }) {
  if (!videoId) return null
  const src = `https://www.youtube.com/embed/${videoId}?start=${Math.floor(start)}&cc_load_policy=1`
  return (
    <div className="w-full aspect-video rounded-xl overflow-hidden ring-1 ring-gray-200 bg-black">
      <iframe className="w-full h-full" src={src} title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen></iframe>
    </div>
  )
}

function TranscriptPane({ segments, selection, onSelectRange, onCreateClip }) {
  const containerRef = useRef(null)

  const handleMouseUp = () => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    const anchor = sel.anchorNode?.parentElement?.dataset?.idx
    const focus = sel.focusNode?.parentElement?.dataset?.idx
    if (anchor == null || focus == null) return
    const a = parseInt(anchor, 10)
    const b = parseInt(focus, 10)
    const startIdx = Math.min(a, b)
    const endIdx = Math.max(a, b)
    const start = segments[startIdx]?.start ?? 0
    const end = segments[endIdx]?.end ?? start
    const text = segments.slice(startIdx, endIdx + 1).map(s => s.text).join(' ')
    onSelectRange({ start, end, snippet: text })
  }

  return (
    <div ref={containerRef} onMouseUp={handleMouseUp} className="h-[50vh] overflow-auto p-3 rounded-lg border border-gray-200 bg-white">
      {segments.length === 0 && (
        <p className="text-gray-500">Transcript will appear here.</p>
      )}
      <div className="space-y-2">
        {segments.map((s, i) => (
          <p key={i} data-idx={i} className="leading-relaxed text-gray-800 select-text">
            <span className="text-xs text-gray-400 mr-2">[{s.start.toFixed(1)}]</span>
            {s.text}
          </p>
        ))}
      </div>
      {selection && (
        <div className="sticky bottom-2 mt-3 flex gap-2 justify-end">
          <button onClick={() => onCreateClip()} className="px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold shadow hover:bg-blue-700">Create Clip</button>
        </div>
      )}
    </div>
  )
}

function Controls({ url, onChangeUrl, onFetch, disabled }) {
  return (
    <div className="w-full max-w-3xl -mt-16 mx-auto px-4">
      <div className="bg-white/90 backdrop-blur rounded-2xl shadow-lg ring-1 ring-gray-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <input value={url} onChange={e=>onChangeUrl(e.target.value)} placeholder="Paste YouTube link here" className="flex-1 px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800" />
          <button onClick={onFetch} disabled={disabled} className="px-4 py-3 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50">Fetch Transcript</button>
        </div>
        <p className="text-xs text-gray-500 mt-2">Highlight transcript text to auto-select a clip. Fine-tune later.</p>
      </div>
    </div>
  )
}

function Timeline({ start, end, onNudge }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-700">
      <span>Start: {start?.toFixed(1) ?? '-'}</span>
      <button onClick={()=>onNudge('start', -1)} className="px-2 py-1 rounded bg-gray-100">-1s</button>
      <button onClick={()=>onNudge('start', +1)} className="px-2 py-1 rounded bg-gray-100">+1s</button>
      <span className="ml-4">End: {end?.toFixed(1) ?? '-'}</span>
      <button onClick={()=>onNudge('end', -1)} className="px-2 py-1 rounded bg-gray-100">-1s</button>
      <button onClick={()=>onNudge('end', +1)} className="px-2 py-1 rounded bg-gray-100">+1s</button>
    </div>
  )
}

function App() {
  const [url, setUrl] = useState('')
  const [videoId, setVideoId] = useState(null)
  const [segments, setSegments] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selection, setSelection] = useState(null) // {start, end, snippet}

  const fetchTranscript = async () => {
    setError(''); setLoading(true)
    try {
      const res = await fetch(`${BACKEND_URL}/api/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setVideoId(data.video_id)
      setSegments(data.segments)
      setSelection(null)
    } catch (e) {
      setError('Gagal mengambil transkrip. Pastikan URL benar atau coba video lain.')
    } finally {
      setLoading(false)
    }
  }

  const createClip = async () => {
    if (!selection || !videoId) return
    const payload = {
      video_id: videoId,
      start: selection.start,
      end: selection.end,
      transcript_snippet: selection.snippet,
      title: 'Clip',
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/clips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      alert(`Clip saved! Share URL: ${data.share_url}`)
    } catch (e) {
      alert('Gagal menyimpan clip')
    }
  }

  const onNudge = (which, delta) => {
    if (!selection) return
    const next = { ...selection }
    next[which] = Math.max(0, (next[which] ?? 0) + delta)
    if (next.end < next.start) next.end = next.start
    setSelection(next)
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <Hero />
      <Controls url={url} onChangeUrl={setUrl} onFetch={fetchTranscript} disabled={loading || !url} />

      <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <YouTubeEmbed videoId={videoId} start={selection?.start ?? 0} />
          <div className="flex items-center justify-between">
            <Timeline start={selection?.start} end={selection?.end} onNudge={onNudge} />
            {selection && (
              <button onClick={createClip} className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold">Save Clip</button>
            )}
          </div>
          {error && <div className="p-3 rounded bg-red-50 text-red-700 text-sm">{error}</div>}
        </div>
        <div>
          <TranscriptPane segments={segments} selection={selection} onSelectRange={setSelection} onCreateClip={createClip} />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pb-20">
        {videoId && (
          <SavedClips videoId={videoId} />
        )}
      </div>
    </div>
  )
}

function SavedClips({ videoId }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/clips?video_id=${videoId}`)
        const data = await res.json()
        setItems(data.items || [])
      } catch {}
      setLoading(false)
    }
    run()
  }, [videoId])

  if (loading) return <p className="text-sm text-gray-500">Loading clips…</p>
  if (!items.length) return null

  return (
    <div className="mt-8">
      <h3 className="font-semibold mb-3">Saved Clips</h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((c) => (
          <a key={c._id} href={c.share_url} target="_blank" className="block p-3 rounded-lg border hover:shadow-sm">
            <div className="text-sm font-medium line-clamp-2">{c.title || 'Clip'}</div>
            <div className="text-xs text-gray-500">{c.start?.toFixed(1)}s – {c.end?.toFixed(1)}s</div>
            {c.transcript_snippet && (
              <div className="mt-2 text-xs text-gray-700 line-clamp-3">{c.transcript_snippet}</div>
            )}
          </a>
        ))}
      </div>
    </div>
  )
}

export default App
