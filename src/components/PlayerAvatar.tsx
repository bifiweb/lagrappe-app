'use client'
import { avatarUrl, getCharacter } from '@/lib/gameCharacters'

interface PlayerAvatarProps {
  avatar: string | null | undefined
  pseudo: string
  size?: number
}

export function PlayerAvatar({ avatar, pseudo, size = 32 }: PlayerAvatarProps) {
  const char = avatar ? getCharacter(avatar) : null

  if (avatar) {
    return (
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', background: '#f5ede8' }}>
          <img
            src={avatarUrl(avatar, char?.skinColor)}
            width={size}
            height={size}
            alt={pseudo}
            style={{ display: 'block', objectFit: 'cover' }}
          />
        </div>
        {char && (
          <span style={{
            position: 'absolute', bottom: -2, right: -2,
            fontSize: size * 0.4, lineHeight: 1,
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))',
          }}>
            {char.emoji}
          </span>
        )}
      </div>
    )
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: '#f5ede8', display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontSize: size * 0.4,
      fontWeight: '500', color: '#8d323b', flexShrink: 0,
    }}>
      {pseudo[0].toUpperCase()}
    </div>
  )
}
