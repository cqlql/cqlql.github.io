package main

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestFaviconServesEmbeddedIcon(t *testing.T) {
	u := &uiState{token: "tok", origin: "http://127.0.0.1:7788"}
	req := httptest.NewRequest(http.MethodGet, "/favicon.ico?token=tok", nil)
	w := httptest.NewRecorder()
	u.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("状态码 = %d", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); ct != "image/x-icon" {
		t.Fatalf("Content-Type = %q", ct)
	}
	if !bytes.Equal(w.Body.Bytes(), uiIcon) {
		t.Fatal("favicon 与嵌入的图标不是同一份字节")
	}
}

func TestFaviconStillNeedsToken(t *testing.T) {
	u := &uiState{token: "tok", origin: "http://127.0.0.1:7788"}
	req := httptest.NewRequest(http.MethodGet, "/favicon.ico", nil)
	w := httptest.NewRecorder()
	u.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("不带 token 的状态码 = %d，想要 401", w.Code)
	}
}

func TestIndexStampsFaviconToken(t *testing.T) {
	u := &uiState{token: "tok", origin: "http://127.0.0.1:7788"}
	req := httptest.NewRequest(http.MethodGet, "/?token=tok", nil)
	w := httptest.NewRecorder()
	u.ServeHTTP(w, req)
	body := w.Body.String()
	if strings.Contains(body, faviconTokenPlaceholder) {
		t.Fatal("favicon 链接里的 token 占位符没被替换")
	}
	if !strings.Contains(body, "/favicon.ico?token=tok") {
		t.Fatal("favicon 链接没有带上 token")
	}
}
