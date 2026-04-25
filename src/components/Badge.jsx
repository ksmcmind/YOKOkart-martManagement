const variants = {
  green:  'badge-green',
  yellow: 'badge-yellow',
  red:    'badge-red',
  gray:   'badge-gray',
  blue:   'badge-blue',
}

const autoColor = (value) => {
  const v = value?.toLowerCase()
  if (['active', 'open', 'delivered', 'paid', 'available'].includes(v))   return 'green'
  if (['pending', 'preparing', 'partial', 'on_trip'].includes(v))          return 'yellow'
  if (['inactive', 'closed', 'cancelled', 'failed', 'offline'].includes(v)) return 'red'
  if (['confirmed', 'assigned', 'picked_up'].includes(v))                  return 'blue'
  return 'gray'
}

export default function Badge({ children, variant, className = '' }) {
  const color = variant || autoColor(children)
  return (
    <span className={`${variants[color] || 'badge-gray'} ${className}`}>
      {children}
    </span>
  )
}