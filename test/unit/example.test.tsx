import { screen } from '@testing-library/react'
import { Button } from '../../components/ui/button';
import { render } from './utils';

describe('Button', () => {
  it('renders the label', () => {
    render(<Button >Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })
})