import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient.js';
import { logAudit } from '../utils.js';

const Inventory = () => {
  const [items, setItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState({
    item_name: '',
    category: 'Medications',
    stock_quantity: '',
    unit: 'pcs',
    reorder_level: '10'
  });
  const [modalMessage, setModalMessage] = useState('');
  const [modalMessageType, setModalMessageType] = useState(''); // 'success' or 'error'
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustItem, setAdjustItem] = useState(null);
  const [adjustData, setAdjustData] = useState({
    type: 'add', // 'add' or 'remove'
    quantity: '',
    reason: ''
  });
  const [adjustModalMessage, setAdjustModalMessage] = useState('');
  const [adjustModalMessageType, setAdjustModalMessageType] = useState(''); // 'success' or 'error'

  // New: delete modal / verification
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleteMessage, setDeleteMessage] = useState('');
  const [deleteMessageType, setDeleteMessageType] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: invData, error: invError } = await supabase.from('inventory').select('*');
        if (invError) throw invError;
        setItems(invData || []);

        const { data: transData, error: transError } = await supabase.from('inventory_transactions').select('*').order('created_at', { ascending: false });
        if (transError) throw transError;
        setTransactions(transData || []);
      } catch (err) {
        console.error('Error fetching inventory data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const refreshData = async () => {
    try {
      const { data: invData } = await supabase.from('inventory').select('*');
      setItems(invData || []);
      const { data: transData } = await supabase.from('inventory_transactions').select('*').order('created_at', { ascending: false });
      setTransactions(transData || []);
    } catch (err) {
      console.error('Error refreshing data:', err);
    }
  };

  const categories = [
    'Medications',
    'Diagnostic Equipment',
    'PPE',
    'Consumables',
    'First Aid / Disinfectants'
  ];

  const filteredItems = items.filter(item =>
    (search.trim() === '' || (item.item_name || '').toLowerCase().includes(search.toLowerCase())) &&
    (selectedCategory === 'All' || (item.category || 'Uncategorized') === selectedCategory)
  );

  const reorderItems = items.filter(item => Number(item.stock_quantity) <= Number(item.reorder_level));

  const addStock = () => setShowAddModal(true);

  const handleNewItemChange = (e) => {
    const { name, value } = e.target;
    setNewItem(prev => ({ ...prev, [name]: value }));
  };

  const submitNewItem = async () => {
    setModalMessage('');
    setModalMessageType('');

    if (!newItem.item_name.trim()) {
      setModalMessage('Item name is required.');
      setModalMessageType('error');
      return;
    }

    const stockQty = Number(newItem.stock_quantity);
    const reorderLvl = Number(newItem.reorder_level);

    if (isNaN(stockQty) || stockQty < 0) {
      setModalMessage('Stock quantity must be a positive number.');
      setModalMessageType('error');
      return;
    }

    if (isNaN(reorderLvl) || reorderLvl <= 0) {
      setModalMessage('Reorder level must be a positive number greater than 0.');
      setModalMessageType('error');
      return;
    }

    // Check for duplicate item name
    const exists = items.find(item => (item.item_name || '').toLowerCase() === newItem.item_name.toLowerCase());
    if (exists) {
      setModalMessage('An item with this name already exists.');
      setModalMessageType('error');
      return;
    }

    try {
      const { error } = await supabase.from('inventory').insert([{
        item_name: newItem.item_name.trim(),
        category: newItem.category,
        stock_quantity: stockQty,
        unit: newItem.unit,
        reorder_level: reorderLvl
      }]);
      if (error) throw error;

      // Add transaction
      await supabase.from('inventory_transactions').insert([{
        item_name: newItem.item_name.trim(),
        transaction_type: 'in',
        quantity: stockQty,
        reason: 'New item added',
        performed_by: 'Dr. Rivera'
      }]);

      // Log audit entry
      await logAudit('Inventory Item Addition', `Added new inventory item: ${newItem.item_name.trim()} with ${stockQty} ${newItem.unit}`);

      // Refresh data
      await refreshData();

      setModalMessage('Item added successfully!');
      setModalMessageType('success');

      // Close modal after success
      setTimeout(() => {
        setShowAddModal(false);
        setNewItem({
          item_name: '',
          category: 'Medications',
          stock_quantity: '',
          unit: 'pcs',
          reorder_level: '10'
        });
        setModalMessage('');
        setModalMessageType('');
      }, 1200);
    } catch (err) {
      console.error('Error adding item:', err);
      setModalMessage('Error adding item: ' + (err.message || 'Unknown error'));
      setModalMessageType('error');
    }
  };

  const adjust = (item) => {
    setAdjustItem(item);
    setShowAdjustModal(true);
    setAdjustData({ type: 'add', quantity: '', reason: '' });
    setAdjustModalMessage('');
    setAdjustModalMessageType('');
  };

  const handleAdjustChange = (e) => {
    const { name, value } = e.target;
    setAdjustData(prev => ({ ...prev, [name]: value }));
  };

  const submitAdjust = async () => {
    setAdjustModalMessage('');
    setAdjustModalMessageType('');

    if (!adjustData.reason.trim()) {
      setAdjustModalMessage('Reason is required.');
      setAdjustModalMessageType('error');
      return;
    }

    const qty = Number(adjustData.quantity);
    if (isNaN(qty) || qty <= 0) {
      setAdjustModalMessage('Quantity must be a positive number.');
      setAdjustModalMessageType('error');
      return;
    }

    const newQty = adjustData.type === 'add' ? Number(adjustItem.stock_quantity) + qty : Number(adjustItem.stock_quantity) - qty;
    if (newQty < 0) {
      setAdjustModalMessage('Cannot remove more than available stock.');
      setAdjustModalMessageType('error');
      return;
    }

    try {
      const { error } = await supabase
        .from('inventory')
        .update({ stock_quantity: newQty })
        .eq('id', adjustItem.id);

      if (error) throw error;

      // Add transaction
      await supabase.from('inventory_transactions').insert([{
        item_name: adjustItem.item_name,
        transaction_type: adjustData.type === 'add' ? 'in' : 'out',
        quantity: qty,
        reason: adjustData.reason.trim(),
        performed_by: 'Dr. Rivera'
      }]);

      // Log audit entry
      const actionType = adjustData.type === 'add' ? 'added to' : 'removed from';
      await logAudit('Inventory Stock Adjustment', `${qty} units ${actionType} inventory: ${adjustItem.item_name}. Reason: ${adjustData.reason.trim()}`);

      // Refresh data
      await refreshData();

      setAdjustModalMessage('Stock adjusted successfully!');
      setAdjustModalMessageType('success');

      // Close modal after success
      setTimeout(() => {
        setShowAdjustModal(false);
        setAdjustItem(null);
        setAdjustData({ type: 'add', quantity: '', reason: '' });
        setAdjustModalMessage('');
        setAdjustModalMessageType('');
      }, 1200);
    } catch (err) {
      console.error('Error adjusting stock:', err);
      setAdjustModalMessage('Error adjusting stock: ' + (err.message || 'Unknown error'));
      setAdjustModalMessageType('error');
    }
  };

  // NEW: Delete flow
  const openDeleteModal = (item) => {
    setDeleteItem(item);
    setDeleteConfirmName('');
    setDeleteMessage('');
    setDeleteMessageType('');
    setShowDeleteModal(true);
  };

  const submitDelete = async () => {
    setDeleteMessage('');
    setDeleteMessageType('');
    if (!deleteItem) return;

    // verification: require exact item name typed
    if ((deleteConfirmName || '').trim() !== (deleteItem.item_name || '')) {
      setDeleteMessage('Please type the exact item name to confirm deletion.');
      setDeleteMessageType('error');
      return;
    }

    try {
      // delete item
      const { error: delErr } = await supabase.from('inventory').delete().eq('id', deleteItem.id);
      if (delErr) throw delErr;

      // add a transaction record for the deletion (out with reason 'deleted')
      await supabase.from('inventory_transactions').insert([{
        item_name: deleteItem.item_name,
        transaction_type: 'out',
        quantity: deleteItem.stock_quantity || 0,
        reason: 'Item deleted from inventory',
        performed_by: 'Dr. Rivera'
      }]);

      // audit log
      await logAudit('Inventory Item Deletion', `Deleted inventory item: ${deleteItem.item_name} (id: ${deleteItem.id})`);

      // refresh
      await refreshData();

      setDeleteMessage('Item deleted successfully.');
      setDeleteMessageType('success');

      setTimeout(() => {
        setShowDeleteModal(false);
        setDeleteItem(null);
        setDeleteConfirmName('');
        setDeleteMessage('');
        setDeleteMessageType('');
      }, 900);
    } catch (err) {
      console.error('Error deleting item:', err);
      setDeleteMessage('Error deleting item: ' + (err.message || 'Unknown error'));
      setDeleteMessageType('error');
    }
  };

  if (loading) return <main className="main"><div className="card">Loading inventory...</div></main>;

  return (
    <main className="main">
      <section className="page">
        {/* Header card (matches Patients header style) */}
        <div className="card" style={{ padding: 16, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 25, fontWeight: 700 }}>Inventory</div>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                id="inventory-search"
                type="search"
                placeholder="Search inventory (item name)"
                style={{ padding: 8, borderRadius: 8, border: '1px solid rgba(0,0,0,0.06)', minWidth: 260 }}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{ padding: 8, borderRadius: 8, border: '1px solid rgba(0,0,0,0.06)' }}
              >
                <option value="All">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              <button className="btn" onClick={addStock}>Add Stock</button>
            </div>
          </div>

          {/* short description below the header (matches Appointments / Patients header style) */}
          <div style={{ marginTop: 8, color: 'var(--muted)', fontSize: 13 }}>
            Manage inventory — view stock levels, add items, adjust stock, and review transactions.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Stock Levels */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>Stock Levels</h3>
              {/* NOTE: the search/category/Add Stock controls were intentionally removed from here
                  because they're now in the header card above. */}
            </div>

            <div style={{ overflow: 'auto', marginBottom: '18px' }}>
              <table className="table" aria-label="Inventory table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Category</th>
                    <th>Stock</th>
                    <th>Unit</th>
                    <th>Reorder Level</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: 20, textAlign: 'center', color: 'var(--muted)' }}>
                        No inventory items found.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map(item => (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 700 }}>{item.item_name}</td>
                        <td>{item.category || 'Uncategorized'}</td>
                        <td>{item.stock_quantity}</td>
                        <td>{item.unit}</td>
                        <td className="label-muted">{item.reorder_level}</td>
                        <td style={{ color: Number(item.stock_quantity) < Number(item.reorder_level) ? 'red' : 'green' }}>
                          {Number(item.stock_quantity) < Number(item.reorder_level) ? 'Low Stock' : 'Adequate'}
                        </td>
                        <td style={{ display: 'flex', gap: 8 }}>
                          <button className="btn secondary" onClick={() => adjust(item)}>Adjust</button>

                          {/* Delete button */}
                          <button
                            className="btn"
                            onClick={() => openDeleteModal(item)}
                            title="Delete this item"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Reorder Alerts */}
          {reorderItems.length > 0 && (
            <div className="card">
              <h3 style={{ margin: 0 }}>Reorder Alerts</h3>
              <div style={{ marginTop: '12px' }}>
                <ul>
                  {reorderItems.map(item => (
                    <li key={item.id} style={{ color: 'red' }}>
                      {item.item_name}: Current stock {item.stock_quantity} {item.unit}, reorder at {item.reorder_level}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Consumables Log */}
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Consumables Log</h3>
            <div style={{ overflow: 'auto' }}>
              <table className="table" aria-label="Inventory transactions table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Type</th>
                    <th>Quantity</th>
                    <th>Reason</th>
                    <th>Performed By</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 16, textAlign: 'center', color: 'var(--muted)' }}>No transactions yet.</td>
                    </tr>
                  ) : (
                    transactions.map(trans => (
                      <tr key={trans.id}>
                        <td>{trans.item_name}</td>
                        <td>{trans.transaction_type}</td>
                        <td>{trans.quantity}</td>
                        <td>{trans.reason || 'N/A'}</td>
                        <td>{trans.performed_by}</td>
                        <td>{new Date(trans.created_at).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Add Item Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
            maxWidth: '400px',
            width: '100%'
          }}>
            <h3>Add New Inventory Item</h3>
            <form onSubmit={(e) => { e.preventDefault(); submitNewItem(); }}>
              <div style={{ marginBottom: '12px' }}>
                <label>Item Name:</label>
                <input
                  name="item_name"
                  type="text"
                  className="input"
                  value={newItem.item_name}
                  onChange={handleNewItemChange}
                  placeholder="Enter item name"
                  required
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label>Category:</label>
                <select
                  name="category"
                  className="input"
                  value={newItem.category}
                  onChange={handleNewItemChange}
                >
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label>Stock Quantity:</label>
                <input
                  name="stock_quantity"
                  type="number"
                  className="input"
                  value={newItem.stock_quantity}
                  onChange={handleNewItemChange}
                  min="0"
                  required
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label>Unit:</label>
                <select
                  name="unit"
                  className="input"
                  value={newItem.unit}
                  onChange={handleNewItemChange}
                >
                  <option value="pcs">pcs</option>
                  <option value="boxes">boxes</option>
                  <option value="ml">ml</option>
                  <option value="mg">mg</option>
                </select>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label>Reorder Level:</label>
                <input
                  name="reorder_level"
                  type="number"
                  className="input"
                  value={newItem.reorder_level}
                  onChange={handleNewItemChange}
                  min="1"
                  required
                />
              </div>
              {modalMessage && (
                <div style={{
                  padding: '8px',
                  marginBottom: '12px',
                  borderRadius: '4px',
                  color: modalMessageType === 'error' ? 'red' : 'green',
                  border: `1px solid ${modalMessageType === 'error' ? 'red' : 'green'}`,
                  fontSize: '14px'
                }}>
                  {modalMessage}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn">Add Item</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {showAdjustModal && adjustItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
            maxWidth: '420px',
            width: '100%'
          }}>
            <h3>Adjust Stock: {adjustItem.item_name}</h3>
            <p>Current Stock: {adjustItem.stock_quantity} {adjustItem.unit}</p>
            <form onSubmit={(e) => { e.preventDefault(); submitAdjust(); }}>
              <div style={{ marginBottom: '12px' }}>
                <label>Action:</label>
                <select
                  name="type"
                  className="input"
                  value={adjustData.type}
                  onChange={handleAdjustChange}
                >
                  <option value="add">Add Stock</option>
                  <option value="remove">Remove Stock</option>
                </select>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label>Quantity:</label>
                <input
                  name="quantity"
                  type="number"
                  className="input"
                  value={adjustData.quantity}
                  onChange={handleAdjustChange}
                  min="1"
                  required
                />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label>Reason:</label>
                <input
                  name="reason"
                  type="text"
                  className="input"
                  value={adjustData.reason}
                  onChange={handleAdjustChange}
                  placeholder="e.g., Restock, Used in treatment"
                  required
                />
              </div>
              {adjustModalMessage && (
                <div style={{
                  padding: '8px',
                  marginBottom: '12px',
                  borderRadius: '4px',
                  color: adjustModalMessageType === 'error' ? 'red' : 'green',
                  border: `1px solid ${adjustModalMessageType === 'error' ? 'red' : 'green'}`,
                  fontSize: '14px'
                }}>
                  {adjustModalMessage}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={() => setShowAdjustModal(false)}>Cancel</button>
                <button type="submit" className="btn">Adjust Stock</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteModal && deleteItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100
        }}>
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            maxWidth: '480px',
            width: '100%'
          }}>
            <h3 style={{ marginTop: 0 }}>Delete Item: {deleteItem.item_name}</h3>
            <p style={{ color: 'var(--muted)' }}>
              This will permanently remove the item from inventory. To confirm, type the item name <strong>{deleteItem.item_name}</strong> below.
            </p>

            <div style={{ marginBottom: 12 }}>
              <input
                className="input"
                type="text"
                placeholder="Type exact item name to confirm"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
              />
            </div>

            {deleteMessage && (
              <div style={{
                padding: '8px',
                marginBottom: '12px',
                borderRadius: '4px',
                color: deleteMessageType === 'error' ? 'red' : 'green',
                border: `1px solid ${deleteMessageType === 'error' ? 'red' : 'green'}`,
                fontSize: '14px'
              }}>
                {deleteMessage}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={submitDelete}>Delete Item</button>
              <button className="btn" onClick={() => setShowDeleteModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Inventory;
