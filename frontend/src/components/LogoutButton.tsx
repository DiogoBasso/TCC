"use client"

export async function LogoutButton() {
  async function onClick() {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include"
    })
    sessionStorage.clear()
    window.location.href = "/login"
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-2 bg-black text-white rounded-xl hover:opacity-80"
    >
      Sair
    </button>
  )
}
