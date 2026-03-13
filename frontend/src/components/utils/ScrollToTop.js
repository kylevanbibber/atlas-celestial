import React, { useState, useEffect, useRef } from 'react';
import { FiChevronUp } from 'react-icons/fi'; // Import arrow icon
import './ScrollToTop.css';

const ScrollToTop = ({ 
  showAfterScrollHeight = 200, // Changed from '200px' to 200 (number)
  position = { bottom: '30px', right: '30px' }, // Default position
  zIndex = 9999, // Higher z-index to ensure visibility
  scrollableContainerSelector = '.page-content' // Default selector for the scrollable container
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const scrollableContainerRef = useRef(null);
  
  useEffect(() => {
    // Find the scrollable container (robust detection)
    const findScrollableContainer = () => {
      // 1) Try provided selector, if any
      if (scrollableContainerSelector) {
        const el = document.querySelector(scrollableContainerSelector);
        if (el) {
          // Use it only if it can actually scroll
          const canScroll = el.scrollHeight > el.clientHeight;
          if (canScroll) {
            console.log('ScrollToTop: Using provided container:', scrollableContainerSelector);
            scrollableContainerRef.current = el;
            return el;
          }
        }
      }

      // 2) Auto-detect from common containers
      const candidates = [
        '.settings-content',
        '.settings-section-large',
        '.settings-section',
        'main',
        'body'
      ];
      for (const sel of candidates) {
        const el = document.querySelector(sel);
        if (el && el.scrollHeight > el.clientHeight) {
          console.log('ScrollToTop: Auto-selected container:', sel);
          scrollableContainerRef.current = el;
          return el;
        }
      }

      // 3) Fallback to window
      console.log('ScrollToTop: Falling back to window');
      return window;
    };

    const scrollableElement = findScrollableContainer();
    
    // Function to handle scroll event
    const handleScroll = () => {
      // Get scroll position from the appropriate element
      const scrollTop = scrollableContainerRef.current 
        ? scrollableContainerRef.current.scrollTop 
        : (window.pageYOffset || document.documentElement.scrollTop);
      
      console.log('ScrollToTop: Current scroll position:', scrollTop, 'threshold:', showAfterScrollHeight);
      
      if (scrollTop > showAfterScrollHeight) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };
    
    // Add scroll event listener to the appropriate element
    scrollableElement.addEventListener('scroll', handleScroll);
    
    // Initial check in case the page is already scrolled
    handleScroll();
    
    // Clean up event listener on component unmount
    return () => {
      scrollableElement.removeEventListener('scroll', handleScroll);
    };
  }, [showAfterScrollHeight, scrollableContainerSelector]);
  
  const scrollToTop = () => {
    console.log('ScrollToTop: Scrolling to top');
    
    if (scrollableContainerRef.current) {
      // Scroll the container to the top
      console.log('ScrollToTop: Scrolling container to top');
      scrollableContainerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    } else {
      // Fallback to window scrolling
      try {
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      } catch (error) {
        document.body.scrollTop = 0; // For Safari
        document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
        console.log('ScrollToTop: Used fallback scrolling method');
      }
    }
  };
  
  const buttonStyle = {
    ...position,
    zIndex
  };
  
  return (
    <button 
      className={`scroll-to-top-button ${isVisible ? 'visible' : 'hidden'}`}
      style={buttonStyle}
      onClick={scrollToTop}
      aria-label="Scroll to top"
    >
      <FiChevronUp size={24} />
    </button>
  );
};

export default ScrollToTop; 