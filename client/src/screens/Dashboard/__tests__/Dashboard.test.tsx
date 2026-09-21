import { render } from '@testing-library/react'
import Dashboard from '../index'

describe('Dashboard', () => {
  it('matches snapshot', () => {
    const { asFragment } = render(<Dashboard />)
    expect(asFragment()).toMatchSnapshot()
  })
})
