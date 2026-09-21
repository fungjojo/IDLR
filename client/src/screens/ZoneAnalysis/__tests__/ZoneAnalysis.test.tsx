import { render } from '@testing-library/react'
import ZoneAnalysis from '../index'

describe('ZoneAnalysis', () => {
  it('matches snapshot', () => {
    const { asFragment } = render(<ZoneAnalysis />)
    expect(asFragment()).toMatchSnapshot()
  })
})
