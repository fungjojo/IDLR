import { render, screen } from '@testing-library/react'
import StatCard from '../index'

describe('StatCard', () => {
  it('matches snapshot without accent', () => {
    const { asFragment } = render(<StatCard label="Distance" value="8.2 km" />)
    expect(asFragment()).toMatchSnapshot()
  })

  it('matches snapshot with accent color', () => {
    const { asFragment } = render(<StatCard label="Avg HR" value="158 bpm" accentColor="#dc2626" />)
    expect(asFragment()).toMatchSnapshot()
  })

  it('renders label and value', () => {
    render(<StatCard label="Time" value="42:15" />)
    expect(screen.getByText('Time')).toBeInTheDocument()
    expect(screen.getByText('42:15')).toBeInTheDocument()
  })
})
