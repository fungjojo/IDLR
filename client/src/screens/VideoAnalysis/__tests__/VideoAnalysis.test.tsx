import { render } from '@testing-library/react'
import VideoAnalysis from '../index'

describe('VideoAnalysis', () => {
  it('matches snapshot', () => {
    const { asFragment } = render(<VideoAnalysis />)
    expect(asFragment()).toMatchSnapshot()
  })
})
