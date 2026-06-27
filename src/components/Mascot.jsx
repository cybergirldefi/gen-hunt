// Official Mochi sticker — CC0 from GenLayer mascot repo
export default function Mascot({ size = 120, style = {}, variant = 'default' }) {
  const STICKERS = {
    default: 'https://raw.githubusercontent.com/genlayer-foundation/genlayer-mascot/main/assets/stickers/mochi-sticker-stonks-up.png',
    idea:    'https://raw.githubusercontent.com/genlayer-foundation/genlayer-mascot/main/assets/stickers/mochi-sticker-idea.png',
    love:    'https://raw.githubusercontent.com/genlayer-foundation/genlayer-mascot/main/assets/stickers/mochi-sticker-love.png',
    cookie:  'https://raw.githubusercontent.com/genlayer-foundation/genlayer-mascot/main/assets/stickers/mochi-sticker-cookie.png',
  }
  return (
    <img
      src={STICKERS[variant] || STICKERS.default}
      alt="Mochi"
      width={size}
      height={size}
      style={{ objectFit:'contain', ...style }}
    />
  )
}
