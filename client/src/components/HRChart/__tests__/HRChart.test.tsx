import { render, screen } from '@testing-library/react'
import HRChart from '../index'

// ResponsiveContainer needs a real DOM with dimensions — mock it in tests
jest.mock('recharts', () => {
  const actual = jest.requireActual<typeof import('recharts')>('recharts')
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="chart-container" style={{ width: 600, height: 200 }}>
        {children}
      </div>
    ),
  }
})

const HR_STREAM = [140, 145, 150, 155, 160, 158, 155, 152, 148, 145]

describe('HRChart', () => {
  it('matches snapshot', () => {
    const { asFragment } = render(
      <HRChart hrStream={HR_STREAM} durationSeconds={600} />,
    )
    expect(asFragment()).toMatchSnapshot()
  })

  it('renders the chart container', () => {
    render(<HRChart hrStream={HR_STREAM} durationSeconds={600} />)
    expect(screen.getByTestId('chart-container')).toBeInTheDocument()
  })
})
