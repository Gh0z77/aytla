import { Redirect } from 'expo-router'

/** Unknown URLs go home instead of showing a dead end. */
export default function NotFound() {
  return <Redirect href="/" />
}
