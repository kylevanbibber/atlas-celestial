import React from 'react';
import './DataTable.css';

const Pagination = ({
  pageIndex,
  pageCount,
  pageOptions,
  gotoPage,
  nextPage,
  previousPage,
  canNextPage,
  canPreviousPage,
}) => {
  // Don't render pagination if there are no pages
  if (pageCount === 0) {
    return null;
  }

  return (
    <div className="pagination-container">
      <div className="pagination-controls">
        <button 
          className="pagination-btn" 
          onClick={() => gotoPage(0)} 
          disabled={pageIndex === 0}
          title="First Page"
        >
          {'<<'}
        </button>
        <button 
          className="pagination-btn" 
          onClick={previousPage} 
          disabled={!canPreviousPage}
          title="Previous Page"
        >
          {'<'}
        </button>
        <span className="pagination-info">
          Page {pageIndex + 1} of {pageCount}
        </span>

        {/* Page selector dropdown */}
        <label className="pagination-label" style={{ marginLeft: 8 }}>
          Go to:
        </label>
        <select
          className="pagination-select"
          value={pageIndex}
          onChange={(e) => gotoPage(Number(e.target.value))}
          style={{ marginLeft: 6 }}
        >
          {(pageOptions && pageOptions.length ? pageOptions : Array.from({ length: pageCount }, (_, i) => i)).map((_, i) => (
            <option key={`page-opt-${i}`} value={i}>{i + 1}</option>
          ))}
        </select>

        <button 
          className="pagination-btn" 
          onClick={nextPage} 
          disabled={!canNextPage}
          title="Next Page"
        >
          {'>'}
        </button>
        <button 
          className="pagination-btn" 
          onClick={() => gotoPage(pageCount - 1)} 
          disabled={pageIndex === pageCount - 1}
          title="Last Page"
        >
          {'>>'}
        </button>
      </div>
    </div>
  );
};

export default Pagination; 