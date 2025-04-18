import { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'

import '@testing-library/jest-dom'
import { AuthProvider } from '@/app/hooks/AuthContext'
import { MantineProvider } from '@mantine/core'

// Optional: extend RTL render to include wrappers like context providers
const AllProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <AuthProvider>
      <MantineProvider>
        {children}
      </MantineProvider>
    </AuthProvider>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }