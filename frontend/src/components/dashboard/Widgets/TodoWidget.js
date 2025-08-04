import React, { useState, useEffect } from 'react';
import './Widgets.css';

const TodoWidget = ({ showCompleted = false, onError }) => {
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async () => {
    try {
      setLoading(true);
      
      // Mock todo data - replace with actual API calls
      const mockTodos = [
        { id: 1, text: 'Follow up with client meeting', completed: false, priority: 'high' },
        { id: 2, text: 'Review insurance applications', completed: false, priority: 'medium' },
        { id: 3, text: 'Submit monthly reports', completed: true, priority: 'high' },
        { id: 4, text: 'Schedule team training', completed: false, priority: 'low' },
        { id: 5, text: 'Update client contact info', completed: true, priority: 'medium' },
      ];

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 200));
      
      setTodos(mockTodos);
    } catch (error) {
      onError && onError(error);
    } finally {
      setLoading(false);
    }
  };

  const addTodo = () => {
    if (newTodo.trim()) {
      const todo = {
        id: Date.now(),
        text: newTodo.trim(),
        completed: false,
        priority: 'medium'
      };
      setTodos([...todos, todo]);
      setNewTodo('');
    }
  };

  const toggleTodo = (id) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const deleteTodo = (id) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const filteredTodos = showCompleted ? todos : todos.filter(todo => !todo.completed);

  if (loading) {
    return (
      <div className="widget-loading">
        <div className="spinner"></div>
        <span>Loading todos...</span>
      </div>
    );
  }

  return (
    <div className="todo-widget">
      <div className="todo-input">
        <input
          type="text"
          placeholder="Add a new task..."
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addTodo()}
          className="todo-input-field"
        />
        <button onClick={addTodo} className="todo-add-btn">+</button>
      </div>

      <div className="todo-list">
        {filteredTodos.length === 0 ? (
          <div className="todo-empty">
            <span>✨ All caught up!</span>
          </div>
        ) : (
          filteredTodos.map(todo => (
            <div key={todo.id} className={`todo-item ${todo.completed ? 'completed' : ''} priority-${todo.priority}`}>
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => toggleTodo(todo.id)}
                className="todo-checkbox"
              />
              <span className="todo-text">{todo.text}</span>
              <button
                onClick={() => deleteTodo(todo.id)}
                className="todo-delete"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      <div className="todo-stats">
        <small>
          {todos.filter(t => !t.completed).length} pending, 
          {todos.filter(t => t.completed).length} completed
        </small>
      </div>
    </div>
  );
};

export default TodoWidget;