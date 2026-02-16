import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import {
  FaChartLine,
  FaCoins,
  FaCrown,
  FaGift,
  FaHistory,
  FaPercentage,
  FaRedoAlt,
  FaStar,
  FaTrophy,
  FaUserEdit,
  FaVolumeMute,
  FaVolumeUp,
} from 'react-icons/fa'
import './App.css'

const STORAGE_KEY = 'tet-2026-lixi-wheel'
const MAX_SPINS = 3
const SPIN_DURATION = 4400
const SPIN_ROUNDS = 8
const CONFETTI_LIFETIME = 2400
const AMOUNTS = Array.from({ length: 15 }, (_, index) => (index + 1) * 10)
const WEIGHTS = [30, 27, 24, 21, 18, 15, 13, 11, 9, 7, 5, 4, 3, 2, 1]
const SEGMENT_COLORS = [
  '#f24949',
  '#f79534',
  '#f7ca28',
  '#fd9d3b',
  '#f35a4a',
  '#f58a38',
  '#f8c92b',
  '#f4513a',
  '#f28a2f',
  '#f5bc2f',
  '#ef4e41',
  '#f08b34',
  '#f5cc3a',
  '#f55f4a',
  '#f3a045',
]
const CONFETTI_COLORS = [
  '#ffe08f',
  '#ffce56',
  '#f9a73c',
  '#f24a45',
  '#f67865',
  '#36b98f',
  '#9ee99f',
]
const TOTAL_WEIGHT = WEIGHTS.reduce((sum, weight) => sum + weight, 0)
const SEGMENT_ANGLE = 360 / AMOUNTS.length

function createDefaultState() {
  return {
    participants: {},
    lastParticipant: '',
  }
}

function normalizeName(name) {
  return name.trim().toLowerCase()
}

function loadStoredState() {
  try {
    const rawData = window.localStorage.getItem(STORAGE_KEY)

    if (!rawData) {
      return createDefaultState()
    }

    const parsed = JSON.parse(rawData)

    if (!parsed || typeof parsed !== 'object') {
      return createDefaultState()
    }

    const participantsSource =
      parsed.participants && typeof parsed.participants === 'object'
        ? parsed.participants
        : {}

    const participants = {}

    Object.entries(participantsSource).forEach(([key, value]) => {
      if (!value || typeof value !== 'object' || typeof value.name !== 'string') {
        return
      }

      const safeSpins = Array.isArray(value.spins)
        ? value.spins
          .filter((spin) => spin && Number.isFinite(Number(spin.amount)))
          .slice(0, MAX_SPINS)
          .map((spin) => ({
            amount: Number(spin.amount),
            time:
              typeof spin.time === 'string' ? spin.time : new Date().toISOString(),
          }))
        : []

      participants[key] = {
        name: value.name,
        spins: safeSpins,
      }
    })

    const lastParticipant =
      typeof parsed.lastParticipant === 'string' ? parsed.lastParticipant : ''

    return {
      participants,
      lastParticipant: Object.hasOwn(participants, lastParticipant)
        ? lastParticipant
        : '',
    }
  } catch {
    return createDefaultState()
  }
}

function pickWeightedIndex(weights) {
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let threshold = Math.random() * total

  for (let index = 0; index < weights.length; index += 1) {
    threshold -= weights[index]

    if (threshold <= 0) {
      return index
    }
  }

  return weights.length - 1
}

function formatAmount(amount) {
  return `${amount}k`
}

function formatTimestamp(timestamp) {
  const time = new Date(timestamp)

  if (Number.isNaN(time.getTime())) {
    return '--:--'
  }

  return time.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  })
}

function createConfettiPieces(pieceCount) {
  return Array.from({ length: pieceCount }, (_, index) => ({
    id: `${index}-${Math.random().toString(36).slice(2, 8)}`,
    driftX: `${(Math.random() - 0.5) * 280}px`,
    fallY: `${180 + Math.random() * 300}px`,
    rotate: `${Math.random() * 360}deg`,
    size: `${6 + Math.random() * 10}px`,
    delay: `${Math.random() * 0.24}s`,
    duration: `${1.3 + Math.random() * 1.2}s`,
    color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
  }))
}

function App() {
  const [gameState, setGameState] = useState(() => loadStoredState())
  const [rotation, setRotation] = useState(0)
  const [isSpinning, setIsSpinning] = useState(false)
  const [lastResult, setLastResult] = useState(null)
  const [activeView, setActiveView] = useState('wheel')
  const [isSoundEnabled, setIsSoundEnabled] = useState(true)
  const [confettiBursts, setConfettiBursts] = useState([])

  const spinTimeoutRef = useRef(null)
  const bootPromptedRef = useRef(false)
  const audioContextRef = useRef(null)
  const confettiTimeoutsRef = useRef([])

  const participantEntries = useMemo(
    () =>
      Object.entries(gameState.participants).sort(([, first], [, second]) => {
        if (second.spins.length !== first.spins.length) {
          return second.spins.length - first.spins.length
        }

        return first.name.localeCompare(second.name, 'vi')
      }),
    [gameState.participants],
  )

  const leaderboard = useMemo(
    () =>
      participantEntries
        .map(([participantKey, participant]) => {
          const total = participant.spins.reduce((sum, spin) => sum + spin.amount, 0)
          const best = participant.spins.reduce(
            (highest, spin) => Math.max(highest, spin.amount),
            0,
          )
          const lastSpin = participant.spins.at(-1)?.time ?? null

          return {
            key: participantKey,
            name: participant.name,
            spins: participant.spins.length,
            total,
            best,
            lastSpin,
          }
        })
        .sort((first, second) => {
          if (second.total !== first.total) {
            return second.total - first.total
          }

          if (second.best !== first.best) {
            return second.best - first.best
          }

          if (second.spins !== first.spins) {
            return second.spins - first.spins
          }

          return first.name.localeCompare(second.name, 'vi')
        }),
    [participantEntries],
  )

  const activeParticipant = gameState.lastParticipant
    ? gameState.participants[gameState.lastParticipant]
    : null

  const activeSpins = activeParticipant?.spins ?? []
  const spinsUsed = activeSpins.length
  const spinsLeft = Math.max(0, MAX_SPINS - spinsUsed)
  const totalReward = activeSpins.reduce((sum, spin) => sum + spin.amount, 0)

  const probabilities = useMemo(
    () =>
      AMOUNTS.map((amount, index) => ({
        amount,
        weight: WEIGHTS[index],
        chance: (WEIGHTS[index] / TOTAL_WEIGHT) * 100,
      })).sort((first, second) => second.amount - first.amount),
    [],
  )

  const wheelGradient = useMemo(() => {
    const layers = AMOUNTS.map((_, index) => {
      const start = index * SEGMENT_ANGLE
      const end = start + SEGMENT_ANGLE
      const color = SEGMENT_COLORS[index % SEGMENT_COLORS.length]
      return `${color} ${start}deg ${end}deg`
    })

    return `conic-gradient(${layers.join(', ')})`
  }, [])

  const promptParticipantName = useCallback(
    async ({ required = false, inputValue = '' } = {}) => {
      const result = await Swal.fire({
        title: 'Nhập tên người tham gia',
        text: 'Vòng quay lì xì tết 2026 đang chờ bạn!',
        input: 'text',
        inputValue,
        inputLabel: 'Tên của bạn là gì?',
        inputPlaceholder: 'Ví dụ: Nguyen Van A',
        confirmButtonText: 'Vào vòng quay',
        cancelButtonText: 'Hủy',
        showCancelButton: !required,
        allowOutsideClick: !required,
        allowEscapeKey: !required,
        reverseButtons: true,
        buttonsStyling: false,
        background: '#fff8ea',
        customClass: {
          popup: 'tet-alert',
          title: 'tet-alert-title',
          htmlContainer: 'tet-alert-text',
          input: 'tet-alert-input',
          confirmButton: 'tet-alert-confirm',
          cancelButton: 'tet-alert-cancel',
        },
        inputValidator: (value) => {
          const trimmed = value?.trim() ?? ''

          if (!trimmed) {
            return 'Vui lòng nhập tên để bắt đầu nhận lì xì.'
          }

          if (trimmed.length > 30) {
            return 'Tên tối đa 30 ký tự.'
          }

          return null
        },
      })

      if (!result.isConfirmed) {
        return
      }

      const cleanName = result.value.trim()
      const participantKey = normalizeName(cleanName)

      setGameState((prev) => {
        const existingParticipant = prev.participants[participantKey]
        const nextParticipants = {
          ...prev.participants,
          [participantKey]: {
            name: cleanName,
            spins: existingParticipant?.spins ?? [],
          },
        }

        return {
          participants: nextParticipants,
          lastParticipant: participantKey,
        }
      })
    },
    [],
  )

  const ensureAudioContext = useCallback(async () => {
    if (!isSoundEnabled) {
      return null
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext

    if (!AudioContextClass) {
      return null
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass()
    }

    if (audioContextRef.current.state === 'suspended') {
      try {
        await audioContextRef.current.resume()
      } catch {
        return null
      }
    }

    return audioContextRef.current
  }, [isSoundEnabled])

  const playToneSequence = useCallback(
    async (sequence) => {
      if (!isSoundEnabled) {
        return
      }

      const context = await ensureAudioContext()

      if (!context) {
        return
      }

      const anchor = context.currentTime + 0.02

      sequence.forEach((tone) => {
        const oscillator = context.createOscillator()
        const gainNode = context.createGain()

        oscillator.type = tone.type ?? 'sine'
        oscillator.frequency.setValueAtTime(tone.frequency, anchor + tone.offset)

        gainNode.gain.setValueAtTime(0.0001, anchor + tone.offset)
        gainNode.gain.exponentialRampToValueAtTime(
          tone.gain ?? 0.06,
          anchor + tone.offset + 0.01,
        )
        gainNode.gain.exponentialRampToValueAtTime(
          0.0001,
          anchor + tone.offset + tone.duration,
        )

        oscillator.connect(gainNode)
        gainNode.connect(context.destination)

        oscillator.start(anchor + tone.offset)
        oscillator.stop(anchor + tone.offset + tone.duration + 0.02)
      })
    },
    [ensureAudioContext, isSoundEnabled],
  )

  const playSpinSound = useCallback(() => {
    void playToneSequence([
      { frequency: 260, offset: 0, duration: 0.06, type: 'triangle', gain: 0.05 },
      { frequency: 300, offset: 0.08, duration: 0.06, type: 'triangle', gain: 0.045 },
      { frequency: 360, offset: 0.16, duration: 0.06, type: 'triangle', gain: 0.04 },
    ])
  }, [playToneSequence])

  const playWinSound = useCallback(() => {
    void playToneSequence([
      { frequency: 392, offset: 0, duration: 0.12, type: 'sine', gain: 0.055 },
      { frequency: 523, offset: 0.14, duration: 0.14, type: 'sine', gain: 0.06 },
      { frequency: 659, offset: 0.3, duration: 0.2, type: 'triangle', gain: 0.065 },
    ])
  }, [playToneSequence])

  const playGrandWinSound = useCallback(() => {
    void playToneSequence([
      { frequency: 523, offset: 0, duration: 0.14, type: 'sine', gain: 0.06 },
      { frequency: 659, offset: 0.16, duration: 0.14, type: 'sine', gain: 0.065 },
      { frequency: 784, offset: 0.32, duration: 0.16, type: 'triangle', gain: 0.07 },
      { frequency: 1046, offset: 0.5, duration: 0.26, type: 'triangle', gain: 0.075 },
    ])
  }, [playToneSequence])

  const launchConfetti = useCallback((pieceCount = 40) => {
    const burstId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    setConfettiBursts((prev) => [
      ...prev,
      {
        id: burstId,
        pieces: createConfettiPieces(pieceCount),
      },
    ])

    const timeoutId = window.setTimeout(() => {
      setConfettiBursts((prev) => prev.filter((burst) => burst.id !== burstId))
      confettiTimeoutsRef.current = confettiTimeoutsRef.current.filter(
        (timerId) => timerId !== timeoutId,
      )
    }, CONFETTI_LIFETIME)

    confettiTimeoutsRef.current.push(timeoutId)
  }, [])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState))
  }, [gameState])

  useEffect(() => {
    if (bootPromptedRef.current) {
      return
    }

    bootPromptedRef.current = true

    const timer = window.setTimeout(() => {
      void promptParticipantName({
        required: true,
        inputValue: activeParticipant?.name ?? '',
      })
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [activeParticipant?.name, promptParticipantName])

  useEffect(() => {
    return () => {
      if (spinTimeoutRef.current) {
        window.clearTimeout(spinTimeoutRef.current)
      }

      confettiTimeoutsRef.current.forEach((timerId) => {
        window.clearTimeout(timerId)
      })
      confettiTimeoutsRef.current = []

      if (audioContextRef.current) {
        const currentAudioContext = audioContextRef.current
        audioContextRef.current = null
        void currentAudioContext.close().catch(() => null)
      }
    }
  }, [])

  const handleSwitchParticipant = () => {
    if (isSpinning) {
      return
    }

    void promptParticipantName({
      required: false,
      inputValue: activeParticipant?.name ?? '',
    })
  }

  const handleChooseExistingParticipant = (participantKey) => {
    if (isSpinning) {
      return
    }

    setGameState((prev) => ({
      ...prev,
      lastParticipant: participantKey,
    }))
  }

  const handleResetData = async () => {
    if (isSpinning) {
      return
    }

    const result = await Swal.fire({
      icon: 'warning',
      title: 'Đặt lại toàn bộ dữ liệu?',
      text: 'Tên người chơi và lịch sử quay sẽ bị xóa khỏi trình duyệt.',
      showCancelButton: true,
      confirmButtonText: 'Đặt lại',
      cancelButtonText: 'Hủy',
      reverseButtons: true,
      buttonsStyling: false,
      customClass: {
        popup: 'tet-alert',
        confirmButton: 'tet-alert-confirm',
        cancelButton: 'tet-alert-cancel',
        title: 'tet-alert-title',
        htmlContainer: 'tet-alert-text',
      },
    })

    if (!result.isConfirmed) {
      return
    }

    window.localStorage.removeItem(STORAGE_KEY)

    if (spinTimeoutRef.current) {
      window.clearTimeout(spinTimeoutRef.current)
      spinTimeoutRef.current = null
    }

    confettiTimeoutsRef.current.forEach((timerId) => {
      window.clearTimeout(timerId)
    })
    confettiTimeoutsRef.current = []

    setGameState(createDefaultState())
    setRotation(0)
    setIsSpinning(false)
    setLastResult(null)
    setConfettiBursts([])
    setActiveView('wheel')

    await Swal.fire({
      icon: 'success',
      title: 'Đã đặt lại dữ liệu',
      text: 'Mời bạn nhập tên để bắt đầu vòng quay mới.',
      confirmButtonText: 'Tiếp tục',
      buttonsStyling: false,
      customClass: {
        popup: 'tet-alert',
        confirmButton: 'tet-alert-confirm',
        title: 'tet-alert-title',
        htmlContainer: 'tet-alert-text',
      },
    })

    void promptParticipantName({ required: true })
  }

  const handleSpin = () => {
    if (isSpinning) {
      return
    }

    if (!activeParticipant) {
      void promptParticipantName({
        required: true,
      })
      return
    }

    if (spinsLeft === 0) {
      void Swal.fire({
        icon: 'info',
        title: 'Bạn đã hết 3 lượt quay',
        text: 'Hay đổi người chơi mới để tiếp tục nhận lì xì đầu năm.',
        confirmButtonText: 'Đã hiểu',
        buttonsStyling: false,
        customClass: {
          popup: 'tet-alert',
          confirmButton: 'tet-alert-confirm',
          title: 'tet-alert-title',
          htmlContainer: 'tet-alert-text',
        },
      })
      return
    }

    playSpinSound()

    const selectedIndex = pickWeightedIndex(WEIGHTS)
    const selectedAmount = AMOUNTS[selectedIndex]
    const activeKey = gameState.lastParticipant
    const activeName = activeParticipant.name
    const currentSpins = activeSpins.length
    const currentTotal = totalReward

    const currentRotation = ((rotation % 360) + 360) % 360
    const centerAngle = selectedIndex * SEGMENT_ANGLE + SEGMENT_ANGLE / 2
    const targetAngle = (360 - centerAngle) % 360
    const extraAngle = (targetAngle - currentRotation + 360) % 360
    const finalRotation = rotation + SPIN_ROUNDS * 360 + extraAngle

    setIsSpinning(true)
    setRotation(finalRotation)

    if (spinTimeoutRef.current) {
      window.clearTimeout(spinTimeoutRef.current)
    }

    spinTimeoutRef.current = window.setTimeout(async () => {
      const spinRecord = {
        amount: selectedAmount,
        time: new Date().toISOString(),
      }

      setGameState((prev) => {
        const participant = prev.participants[activeKey]

        if (!participant) {
          return prev
        }

        return {
          ...prev,
          participants: {
            ...prev.participants,
            [activeKey]: {
              ...participant,
              spins: [...participant.spins, spinRecord],
            },
          },
        }
      })

      setLastResult(selectedAmount)
      setIsSpinning(false)
      launchConfetti(38)
      playWinSound()

      await Swal.fire({
        icon: 'success',
        title: `Chúc mừng ${activeName}!`,
        html: `<strong>Bạn vừa nhận được ${formatAmount(selectedAmount)}</strong>`,
        confirmButtonText: 'Nhận lì xì',
        buttonsStyling: false,
        customClass: {
          popup: 'tet-alert',
          confirmButton: 'tet-alert-confirm',
          title: 'tet-alert-title',
          htmlContainer: 'tet-alert-text',
        },
      })

      if (currentSpins + 1 === MAX_SPINS) {
        const grandTotal = currentTotal + selectedAmount

        launchConfetti(70)
        playGrandWinSound()

        await Swal.fire({
          icon: 'success',
          title: `Hoàn tất 3 lượt quay - ${activeName}`,
          html: `Tổng tiền thưởng của bạn là <strong>${formatAmount(grandTotal)}</strong>.<br/>Chúc mừng năm mới 2026 phát tài phát lộc!`,
          confirmButtonText: 'Nhận lì xì',
          buttonsStyling: false,
          customClass: {
            popup: 'tet-alert',
            confirmButton: 'tet-alert-confirm',
            title: 'tet-alert-title',
            htmlContainer: 'tet-alert-text',
          },
        })
      }

      spinTimeoutRef.current = null
    }, SPIN_DURATION + 120)
  }

  return (
    <div className="tet-app">
      <div className="confetti-layer" aria-hidden="true">
        {confettiBursts.map((burst) => (
          <div key={burst.id} className="confetti-burst">
            {burst.pieces.map((piece) => (
              <span
                key={piece.id}
                className="confetti-piece"
                style={{
                  '--drift-x': piece.driftX,
                  '--fall-y': piece.fallY,
                  '--rotate-base': piece.rotate,
                  '--piece-size': piece.size,
                  '--delay': piece.delay,
                  '--duration': piece.duration,
                  '--piece-color': piece.color,
                }}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="sticker sticker-1">🧧</div>
      <div className="sticker sticker-2">🌸</div>
      <div className="sticker sticker-3">🏮</div>
      <div className="sticker sticker-4">🐉</div>
      <div className="sticker sticker-5">🎊</div>

      <header className="hero-card">
        <p className="year-badge">XUÂN BÍNH NGỌ 2026</p>
        <h1>Vòng Quay Lì Xì Tết 2026</h1>
        <p className="hero-text">
          Quay lểnh lảng, nhận lộc ngập tràn. Mệnh giá cao hơn có tỉ lệ thấp hơn để
          trò chơi công bằng và hấp dẫn.
        </p>
        <div className="hero-info">
          <div className="hero-pill">
            <FaCoins />
            <span>
              Tổng hiện tại: <strong>{formatAmount(totalReward)}</strong>
            </span>
          </div>
          <div className="hero-pill">
            <FaGift />
            <span>
              Còn lại: <strong>{spinsLeft}/3 luot</strong>
            </span>
          </div>
        </div>

        <div className="hero-toolbar">
          <div className="view-switch" role="tablist" aria-label="Che do hien thi">
            <button
              type="button"
              className={`view-button ${activeView === 'wheel' ? 'active' : ''}`}
              onClick={() => setActiveView('wheel')}
              disabled={isSpinning}
            >
              <FaGift />
              Vòng quay
            </button>
            <button
              type="button"
              className={`view-button ${activeView === 'leaderboard' ? 'active' : ''}`}
              onClick={() => setActiveView('leaderboard')}
              disabled={isSpinning}
            >
              <FaChartLine />
              Bảng vàng
            </button>
          </div>

          <div className="utility-actions">
            <button
              type="button"
              className="tiny-button"
              onClick={() => setIsSoundEnabled((prev) => !prev)}
            >
              {isSoundEnabled ? <FaVolumeUp /> : <FaVolumeMute />}
              {isSoundEnabled ? 'Âm thanh: bật' : 'Âm thanh: tắt'}
            </button>
            <button
              type="button"
              className="tiny-button danger"
              onClick={handleResetData}
              disabled={isSpinning}
            >
              <FaRedoAlt />
              Đặt lại dữ liệu
            </button>
          </div>
        </div>
      </header>

      {activeView === 'wheel' ? (
        <main className="content-grid">
          <aside className="card-panel history-panel">
            <div className="panel-title">
              <FaHistory />
              <h2>Lịch sử quay</h2>
            </div>

            <div className="current-user">
              <FaCrown />
              <div>
                <p>Người đang quay</p>
                <strong>{activeParticipant?.name ?? 'Chưa có'}</strong>
              </div>
            </div>

            <div className="participant-tags">
              {participantEntries.map(([participantKey, participant]) => (
                <button
                  key={participantKey}
                  type="button"
                  className={`tag-button ${participantKey === gameState.lastParticipant ? 'active' : ''
                    }`}
                  onClick={() => handleChooseExistingParticipant(participantKey)}
                  disabled={isSpinning}
                >
                  {participant.name}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="outline-button"
              onClick={handleSwitchParticipant}
              disabled={isSpinning}
            >
              <FaUserEdit />
              Đổi người chơi
            </button>

            <ul className="history-list">
              {activeSpins.length === 0 ? (
                <li className="history-empty">Chưa có lượt quay nào. Hãy bấm quay ngay!</li>
              ) : (
                activeSpins.map((spin, index) => (
                  <li key={`${spin.time}-${index}`} className="history-item">
                    <div>
                      <p>Lần {index + 1}</p>
                      <strong>{formatAmount(spin.amount)}</strong>
                    </div>
                    <span>{formatTimestamp(spin.time)}</span>
                  </li>
                ))
              )}
            </ul>
          </aside>

          <section className="card-panel wheel-panel">
            <div className="wheel-stage">
              <div className="wheel-pointer">
                <span>🪙</span>
              </div>
              <div className="wheel-frame">
                <div
                  className="wheel"
                  style={{
                    background: wheelGradient,
                    transform: `rotate(${rotation}deg)`,
                    transitionDuration: `${SPIN_DURATION}ms`,
                  }}
                >
                  {AMOUNTS.map((amount, index) => {
                    const angle = index * SEGMENT_ANGLE + SEGMENT_ANGLE / 2

                    return (
                      <div
                        key={amount}
                        className="wheel-label"
                        style={{
                          transform: `rotate(${angle}deg) translate(0, calc(-1 * var(--label-radius)))`,
                        }}
                      >
                        <span
                          style={{
                            transform: `translate(-50%, -50%) rotate(${-angle}deg)`,
                          }}
                        >
                          {formatAmount(amount)}
                        </span>
                      </div>
                    )
                  })}
                  <div className="wheel-center">
                    <FaStar />
                    <small>Loc</small>
                  </div>
                </div>
              </div>
            </div>

            <div className="spin-actions">
              <button
                type="button"
                className="spin-button"
                onClick={handleSpin}
                disabled={isSpinning || spinsLeft === 0}
              >
                <FaGift />
                {isSpinning ? 'Đang quay...' : 'Quay nhận lì xì'}
              </button>
            </div>

            <p className="result-note">
              {lastResult
                ? `Lần quay gần nhất bạn nhận được ${formatAmount(lastResult)}.`
                : 'Nhấn nút quay để săn lì xì đầu năm 2026!'}
            </p>
          </section>

          <aside className="card-panel odds-panel">
            <div className="panel-title">
              <FaPercentage />
              <h2>Tỉ lệ mệnh giá</h2>
            </div>
            <p className="odds-note">
              Mệnh giá càng cao thì xác suất càng thấp. Mức 150k là hiếm nhất.
            </p>
            <ul className="odds-list">
              {probabilities.map((item) => (
                <li key={item.amount} className="odds-item">
                  <div className="odds-row">
                    <strong>{formatAmount(item.amount)}</strong>
                    <span>{item.chance.toFixed(2)}%</span>
                  </div>
                  <div className="odds-bar">
                    <div
                      style={{
                        width: `${(item.weight / WEIGHTS[0]) * 100}%`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        </main>
      ) : (
        <section className="leaderboard-wrap">
          <div className="card-panel leaderboard-panel">
            <div className="leaderboard-header">
              <div className="panel-title">
                <FaTrophy />
                <h2>Bảng vàng lì xì</h2>
              </div>
              <p>
                Xếp hạng tổng tiền thưởng của tất cả người chơi.
              </p>
            </div>

            {leaderboard.length === 0 ? (
              <p className="leaderboard-empty">
                Chưa có người chơi nào trong dữ liệu. Hãy quay vòng quay để hiển thị tên lên
                bảng vàng!
              </p>
            ) : (
              <ol className="leaderboard-list">
                {leaderboard.map((player, index) => (
                  <li
                    key={player.key}
                    className={`leaderboard-item ${index === 0 ? 'champion' : ''}`}
                  >
                    <div className="rank-badge">#{index + 1}</div>

                    <div className="leaderboard-main">
                      <div className="leaderboard-name-row">
                        <strong>{player.name}</strong>
                        {index === 0 ? (
                          <span className="leaderboard-crown">
                            <FaCrown />
                            Top 1
                          </span>
                        ) : null}
                      </div>
                      <p>
                        {player.spins}/{MAX_SPINS} lượt - Cao nhất{' '}
                        {formatAmount(player.best)} - Lần cuối{' '}
                        {player.lastSpin ? formatTimestamp(player.lastSpin) : '--:--'}
                      </p>
                    </div>

                    <div className="leaderboard-total">{formatAmount(player.total)}</div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

export default App
