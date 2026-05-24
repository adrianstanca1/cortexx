const React = require('react');

const View = ({ children, ...props }) => React.createElement('div', { ...props, 'data-testid': 'View' }, children);
const Text = ({ children, ...props }) => React.createElement('span', { ...props, 'data-testid': 'Text' }, children);
const Pressable = ({ children, onPress, ...props }) =>
  React.createElement('button', { ...props, onClick: onPress, 'data-testid': 'Pressable' }, children);

module.exports = {
  View,
  Text,
  Pressable,
};
