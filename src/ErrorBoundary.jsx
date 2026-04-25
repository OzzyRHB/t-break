import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }
  componentDidCatch(error, info) {
    this.setState({ error, info });
    console.error('CRASH:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: 'monospace', background: '#1a1a1a', color: '#ff6b6b', minHeight: '100vh' }}>
          <h2>💥 Crash details</h2>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#ff9999' }}>{this.state.error?.toString()}</pre>
          <hr style={{ borderColor: '#444' }}/>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#aaa', fontSize: 11 }}>{this.state.info?.componentStack}</pre>
          <button onClick={() => this.setState({ error: null, info: null })}
            style={{ marginTop: 16, padding: '8px 16px', cursor: 'pointer' }}>
            Probeer opnieuw
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
