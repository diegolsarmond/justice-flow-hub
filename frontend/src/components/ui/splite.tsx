import { Component, ReactNode, Suspense, lazy } from 'react'
const Spline = lazy(() => import('@splinetool/react-spline'))

interface SplineSceneProps {
  scene: string
  className?: string
}

interface SplineErrorBoundaryProps {
  fallback: ReactNode
  children: ReactNode
}

class SplineErrorBoundary extends Component<SplineErrorBoundaryProps, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error(error)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }

    return this.props.children
  }
}

export function SplineScene({ scene, className }: SplineSceneProps) {
  const fallback = (
    <div className="w-full h-full flex items-center justify-center">
      <span className="loader"></span>
    </div>
  )

  return (
    <SplineErrorBoundary
      key={scene}
      fallback={fallback}
    >
      <Suspense fallback={fallback}>
        <Spline
          scene={scene}
          className={className}
        />
      </Suspense>
    </SplineErrorBoundary>
  )
}
