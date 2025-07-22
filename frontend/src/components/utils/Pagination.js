import React from 'react';
import './DataTable.css';

const Pagination = ({
  pageIndex,
  pageCount,
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