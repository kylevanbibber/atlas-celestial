import React from 'react';
import ScrollToTop from './ScrollToTop';

const ScrollToTopExample = () => {
  return (
    <div>
      <h1>Page with ScrollToTop</h1>
      
      {/* This content is just for demonstration */}
      <div style={{ height: '200vh', padding: '20px' }}>
        <p>Scroll down to see the button appear, then click it to scroll back to top.</p>
        <div style={{ marginTop: '100vh' }}>
          <p>You should see the scroll-to-top button at the bottom right of the screen.</p>
        </div>
      </div>
      
      {/* 
        Add the ScrollToTop component anywhere in your page component.
        It will automatically handle visibility based on scroll position.
      */}
      <ScrollToTop />
      
      {/* 
        You can also customize it:
        <ScrollToTop 
          showAfterScrollHeight={500} 
          position={{ bottom: '30px', right: '30px' }}
          zIndex={2000} 
        />
      */}
    </div>
  );
};

export default ScrollToTopExample; 